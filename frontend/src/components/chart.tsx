import React, { useEffect, useRef, useState, Component } from 'react';
import { observer } from 'mobx-react';
import { toJS } from "mobx";
import embed, { VisualizationSpec, EmbedOptions } from "vega-embed";
import * as vega from 'vega'; // Import vega for changeset functionality
import * as _ from 'lodash';

import {
    APIState,
    Cell,
    InteractStatus,
    LabelCoord,
    LegendMapping,
    SpecModifyType
} from '../util.tsx';
import { MainStore } from '../mainstore';

import { AudioOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, SyncOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Space, Progress, Flex, Spin, Alert, Tag } from 'antd';
import { VegaLite } from "react-vega";
import vegaEmbed from "vega-embed";
import * as d3 from "d3";
import { SpeechContainerV4 } from './speech.tsx';
import { enhanceDataLLM } from '../llm.ts';

export const ChartContainerV5 = observer(({ mainstore }: { mainstore: MainStore }) => {
    // Reference to the Vega view
    const vegaViewRef = useRef<any>(null);

    // ChartExpanding
    // ---------scatter plot: start----------
    const distillCoords4Scatter = (data) => {
        // sort data to make sure labels starting from left to RightCircleFilled, top to bottom
        data = _.sortBy(data, ['x', 'y'])
        // if legends exist, mark label starting from legend items 
        let legendItemCount = mainstore.legendMapping.length

        let items: any = []
        if (mainstore.count == 1) {// have id for every data items
            _.forEach(data, (item, index) => {
                items.push(
                    {
                        ...item.datum,
                        // id: "id" + (index + 1),
                        id: legendItemCount > 0 ? 'id' + (index + 1 + legendItemCount) : 'id' + (index + 1),
                        xCoord: _.round(item.x, 0),
                        yCoord: _.round(item.y, 0),
                        label: legendItemCount > 0 ? (index + 1 + legendItemCount) + "" : (index + 1) + "",
                    }
                )
            })

            // set org domian
            mainstore.domainsOrg.xDomain = mainstore.xyScales.xDomain
            mainstore.domainsOrg.yDomain = mainstore.xyScales.yDomain
        } else {
            // check if there are selects, if there is, label from selected items
            if (mainstore.selectedItems.length > 0) {
                let selectedDataItems = _.filter(data, o => _.includes(mainstore.selectedItems, o.datum.id))
                let unSelectedDataItems = _.filter(data, o => !_.includes(mainstore.selectedItems, o.datum.id))
                // console.log("selectedDataItems", selectedDataItems);
                // console.log("unSelectedDataItems", unSelectedDataItems);

                data = _.concat(selectedDataItems, unSelectedDataItems)
            }

            _.forEach(data, (item, index) => {
                items.push(
                    {
                        ...item.datum,
                        xCoord: _.round(item.x, 0),
                        yCoord: _.round(item.y, 0),
                        label: legendItemCount > 0 ? (index + 1 + legendItemCount) + "" : (index + 1) + "",
                    }
                )
            })
        }
        // console.log('data with coordinates:', items);

        return items
    }

    const updateSpec4SmoothScatter = (spec) => {
        const newSpec = _.cloneDeep(spec)
        const data = newSpec.data.values

        // axia and yaxis label not showing properly: update data
        // newSpec['data'] = { name: "dataTable" } // Placeholder for programmatic data updates

        // FIXME:
        // update domain
        newSpec['encoding']['x']['scale']['domain'] = { param: "xDomain" }
        newSpec['encoding']['y']['scale']['domain'] = { param: "yDomain" }

        // get the min and max for x and y domains
        let xField = mainstore.encodingFields['x']
        let yField = mainstore.encodingFields['y']

        let minX = _.minBy(data, xField)[xField]
        let maxX = _.maxBy(data, xField)[xField]
        let minY = _.minBy(data, yField)[yField]
        let maxY = _.maxBy(data, yField)[yField]

        newSpec['params'] = newSpec['params'] || []
        newSpec['params'].push({
            name: "xDomain", // Parameter to control the x-axis domain
            value: [
                _.floor(Math.min(minX - Math.abs(minX) * 0.2, 0)),
                _.ceil(maxX + Math.min(Math.abs(maxX) * 0.2, 1))], // Default domain with padding
        })
        newSpec['params'].push({
            name: "yDomain", // Parameter to control the x-axis domain
            value: [
                _.floor(Math.min(minY - Math.abs(minY) * 0.2, 0)),
                _.ceil(maxY + Math.min(Math.abs(maxY) * 0.2, 1))], // Default domain with padding
        })

        return newSpec
    }
    // ---------scatter plot: end----------

    const getTransform = () => {
        // Use D3 to select the SVG element
        const svg = d3.select("#chart-container").select("svg");

        // Select the <g> element with the transform attribute
        const group = svg.select("g");

        // Get the transform attribute
        const transform = group.attr("transform");
        // console.log("Transform attribute:", transform);

        if (svg && group && transform) {
            // Parse the transform (e.g., translate(x, y))
            const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
            if (translateMatch) {
                const [_, x, y] = translateMatch;
                // + str: a shorthand to convert a string into a number
                mainstore.gTransform = { x: +x, y: +y }
            } else {
                console.log("No translate found in transform attribute.");
            }
        } else {
            console.log("no svg, or group, or transform found.");
        }
    }

    const getLegendMapping = (symbolClass: string, valueClass: string) => {
        const mapping: LegendMapping[] = []

        const valueItems = d3.selectAll(`.${valueClass}`);
        const symbolItems = d3.selectAll(`.${symbolClass}`);

        // FIXME: only applicable for color, shape is not properly distilled
        _.forEach(symbolItems.nodes(), (element, index) => {
            const sym = d3.select(element)
                .select("path")
                .attr("stroke");
            const ctm = d3.select(element)
                .node()
                .getCTM();

            mapping.push({
                id: "id" + (index + 1),
                label: (index + 1) + "",

                // get coords
                x: _.round(ctm.e - mainstore.gTransform.x, 1), // first transform have been applied to the overlaid svg, so it should be excluded from the ctm
                y: _.round(ctm.f - mainstore.gTransform.y, 1), // same as x
                // x: _.round(ctm.e, 1),
                // y: _.round(ctm.f, 1),

                // get encoding info
                colorOrg: sym,
                value: '',
            })
        })

        _.forEach(valueItems.nodes(), (element, index) => {
            const val = d3.select(element)
                .select("text")
                .text();

            mapping[index].value = val
        })

        mainstore.legendMapping = mapping
        // console.log("legendMapping", mapping);
    }

    const getLegendItemCoords = (className: string) => {
        let legendItemCoords: LabelCoord[] = []

        // Select all elements with the class "role-legend-label"
        const legendItems = d3.selectAll(`.${className}`);
        // Iterate over each element
        _.forEach(legendItems.nodes(), (element, index) => {
            const tempItem = d3.select(element).node(); // Get the current element in the selection
            // console.log("legend element", element);

            // Get the CTM (Current Transformation Matrix) of the rectangle
            const ctm = tempItem.getCTM();

            if (ctm) {
                // Log the CTM
                // console.log(`CTM:`, ctm);
                legendItemCoords.push({
                    id: "id" + (index + 1),
                    label: (index + 1) + '',
                    x: _.round(ctm.e - mainstore.gTransform.x, 1), // first transform have been applied to the overlaid svg, so it should be excluded from the ctm
                    y: _.round(ctm.f - mainstore.gTransform.y, 1), // same as x
                    // x: _.round(ctm.e, 1),
                    // y: _.round(ctm.f, 1)
                })
            }
        });

        // Log the final coordinates array
        // console.log("Legend Item Coordinates:", legendItemCoords);

        // mainstore.legendItemCoords = legendItemCoords
    }

    // enhance data when first rendering, only enhance once
    async function enhanceData() {
        let result = await enhanceDataLLM(mainstore.chartSpec)

        const enhancedData = result.data
        mainstore.chartSpec.data.values = enhancedData

        // also works for: color and shape are encoded using the same field
        const colorMapping = result.colorMapping
        _.forEach(colorMapping, (item) => {
            _.forEach(mainstore.legendMapping, (o: LegendMapping) => {
                if (o.value == item.value) {
                    o.colorSimple = item.color
                    o.ids = item.ids
                }
            })
        })

        const shapeMapping = result.shapeMapping
        _.forEach(shapeMapping, (item) => {
            _.forEach(mainstore.legendMapping, (o: LegendMapping) => {
                if (o.value == item.value) {
                    o.shape = item.shape
                    o.ids = item.ids
                }
            })
        })

        console.log("mainstore", toJS(mainstore));
    }

    const showTaskStatus = () => {
        const showProcessInfo = () => {
            if (mainstore.apiState == APIState.Sending) {
                return <Tag icon={<SyncOutlined spin />} color="processing" style={{ marginRight: 0 }}>
                    processing
                </Tag>
            } else if (mainstore.apiState == APIState.Success) {
                return <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginRight: 0 }}>
                    success
                </Tag>
            } else if (mainstore.apiState == APIState.Fail) {
                return <Tag icon={<CloseCircleOutlined />} color="error" style={{ marginRight: 0 }}>
                    error
                </Tag>
            } else {// default: show no tip info
                return ""
            }
        }

        if (mainstore.interactions.length > 0) {
            const unitNow = mainstore.unitNow
            const task: string = unitNow?.task || ""

            // draw UI to show the info
            return (
                <Flex gap={5} align='flex-start'>
                    {task == "" ?
                        <Tag bordered={false} color="magenta" style={{ marginRight: 0 }}>
                            {task}
                        </Tag> : ""
                    }
                    {showProcessInfo()}
                </Flex>
            )
        }
    }

    useEffect(() => {
        // const data = mainstore.chartSpec.data.values
        const newSpec = updateSpec4SmoothScatter(mainstore.chartSpec)
        // console.log("newSpec", newSpec);

        // Embed the chart in the #chart-container div
        vegaEmbed("#chart-container",
            toJS(newSpec),
            { actions: false, renderer: "svg" })
            .then(result => {
                // Access the Vega view
                const view = result.view;

                // Save the Vega view reference
                vegaViewRef.current = view;

                // Insert initial data
                // view.change("dataTable", vega.changeset().insert(data)).run();

                // Run the pipeline to process the data
                view.runAsync().then(() => {
                    // 2. put the scales into store
                    mainstore.xyScales = {
                        x: view.scale('x'),
                        xDomain: view.scale('x').domain(),
                        xInvert: view.scale('x').invert,
                        y: view.scale('y'),
                        yDomain: view.scale('y').domain(),
                        yInvert: view.scale('y').invert
                    }
                    // console.log(toJS(mainstore.xyScales.xDomain), toJS(mainstore.xyScales.yDomain));

                    // info sharing: 3 (scale info) > 4 (legend info) | 5 (legend mapping) > 1
                    // 3. get the transform info from rendered svg
                    getTransform()

                    // 4. get the legend coordinates > merge into legend mapping
                    // class for symbol: role-legend-symbol
                    // class for label: role-legend-label
                    // getLegendItemCoords('role-legend-symbol')

                    // 5. get legend mapping
                    getLegendMapping('role-legend-symbol', 'role-legend-label')

                    // 1. distill the pixel coordinates of data items and put into store
                    // Extract the processed data from the "marks" dataset
                    const data = view.data('marks');
                    let dataItems = distillCoords4Scatter(data)

                    // store pixel coordinates of data items
                    // cover when first rendering
                    mainstore.chartSpec.data.values = dataItems

                    // 6. enhance data 
                    if (mainstore.count == 1 && mainstore.isDataEnhanced == false) {// enhance 
                        mainstore.isDataEnhanced = true
                        // FIXME: uncomment when it's formal
                        // enhanceData()
                    }
                });
            })
            .catch((err) =>
                console.error(err)
            );

        return () => {
            vegaViewRef.current = null; // Cleanup on unmount
        };
    }, [mainstore.renderFlags.reRender]);

    useEffect(() => {
        const unitNow = mainstore.unitNow

        if (unitNow) {
            if (vegaViewRef.current) {
                // if (unitNow.modifyType
                //     && unitNow.modifyType == SpecModifyType.Data
                //     && unitNow.newData) {
                //     console.log("update data only");

                //     // Update the chart with new data
                //     vegaViewRef.current.change(
                //         "dataTable",
                //         vega.changeset().remove(() => true).insert(unitNow.newData) // Remove old data and insert new data
                //     ).run();
                // }

                // smoothly update domains
                if (unitNow.modifyType
                    && unitNow.modifyType == SpecModifyType.Domain
                    && unitNow.newDomain) {
                    // Update the chart with new domains
                    vegaViewRef.current.signal("xDomain", unitNow.newDomain.xDomain).run(); // Update the parameter
                    vegaViewRef.current.signal("yDomain", unitNow.newDomain.yDomain).run(); // Update the parameter

                    // update to store (chart not re-render, domain not update)
                    mainstore.xyScales.xDomain = unitNow.newDomain.xDomain
                    mainstore.xyScales.yDomain = unitNow.newDomain.yDomain
                }
            }
        } else {
            // console.log("unitNow is null.");
        }
    }, [mainstore.renderFlags.smooth]);

    const render = () => {
        return (
            <div className="chart-panel">
                <div style={{ width: 500 }}>
                    <Flex justify='flex-end' align='center' style={{ width: "100%", padding: 5, marginBottom: 10 }}>
                        {showTaskStatus()}
                    </Flex>
                </div>
                <div style={{ position: 'relative' }}>
                    <div id='chart-container'></div>
                    {/* the size of svg should align with and bigger than the chart mainbox */}
                    {/* overflow to make sure elements inside of svg show, to adapt to the grids showing for aggregation */}
                    <svg id="chart-overlay" width={400 + 80} height={300 + 80} style={{ position: 'absolute', left: mainstore.gTransform.x, top: mainstore.gTransform.y, overflow: 'visible' }}></svg>
                    <div id='chart-tooltip'></div>
                </div>
            </div>
        );
    };

    return render();
});

export const ChartContainerV4 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const distillCoords = (data) => {
        // FIXME: adjust labels when there are selection, label start from selected items
        let items: any = []
        if (mainstore.count == 1) {// have id for every data items
            _.forEach(data, (item, index) => {
                items.push(
                    // FIXME: avoid axis name to be x and y
                    // cause there will be conflicts to distill xy coords
                    {
                        ...item.datum,
                        xCoord: _.round(item.x, 3),
                        yCoord: _.round(item.y, 3),
                        label: (index + 1) + "",
                        id: "id" + (index + 1)
                    }
                )
            })
        } else {
            // check if there are selects, if there is, label from selected items
            if (mainstore.selectedItems.length > 0) {
                // console.log("data", data);
                // console.log("mainstore.selectedItems", toJS(mainstore.selectedItems));

                let selectedDataItems = _.filter(data, o => _.includes(mainstore.selectedItems, o.datum.id))
                let unSelectedDataItems = _.filter(data, o => !_.includes(mainstore.selectedItems, o.datum.id))
                // console.log("selectedDataItems", selectedDataItems);
                // console.log("unSelectedDataItems", unSelectedDataItems);

                data = _.concat(selectedDataItems, unSelectedDataItems)
            }

            _.forEach(data, (item, index) => {
                items.push(
                    // FIXME: avoid axis name to be x and y
                    // cause there will be conflicts to distill xy coords
                    { ...item.datum, xCoord: _.round(item.x, 3), yCoord: _.round(item.y, 3), label: (index + 1) + "" }
                )
            })
        }
        // console.log('items', items);

        return items
    }

    const getTransform = () => {
        // Use D3 to select the SVG element
        const svg = d3.select("#chart-container").select("svg");

        // Select the <g> element with the transform attribute
        const group = svg.select("g");

        // Get the transform attribute
        const transform = group.attr("transform");
        // console.log("Transform attribute:", transform);

        if (svg && group && transform) {
            // Parse the transform (e.g., translate(x, y))
            const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
            if (translateMatch) {
                const [_, x, y] = translateMatch;
                // console.log("Translate X:", x, typeof (+x));
                // console.log("Translate Y:", y);

                // put into store
                // + str: a shorthand to convert a string into a number
                mainstore.gTransform = { x: +x, y: +y }
            } else {
                console.log("No translate found in transform attribute.");
            }
        } else {
            console.log("no svg, or group, or transform found.", svg, group, transform);
        }
    }

    // update with Tag component
    const showTaskProgress = () => {
        if (mainstore.interactions.length > 0) {
            const unitNow = mainstore.unitNow

            const progress = { task: "", stepNow: 1, stepsWhole: 2 }
            if (unitNow) {
                const task = unitNow?.task
                if (task) {
                    // update task
                    progress.task = task

                    if (unitNow.status) {
                        // adjust step whole based on task type and interact status
                        if (unitNow.status == InteractStatus.Direct) {
                            progress.stepsWhole = 1
                        } else {
                            if (task == "select") {
                                progress.stepsWhole = 3
                            }
                        }

                        // adjust step now based on interact status
                        if (unitNow.status == InteractStatus.Start) {
                            progress.stepNow = 1
                        } else if (unitNow.status == InteractStatus.Ongoing) {
                            progress.stepNow = progress.stepsWhole == 2 ? 1 : 2
                        } else if (unitNow.status == InteractStatus.End) {
                            progress.stepNow = progress.stepsWhole == 2 ? 2 : 3
                        }
                    } else {
                        console.log("No status.");
                    }
                } else {
                    // console.log("No task.");
                }
            } else {
                console.log("unitNow is null.");
            }

            // draw UI to show the info
            return (
                <Flex gap={5} align='flex-start'>
                    <Tag bordered={false} color="magenta" style={{ marginRight: 0 }}>
                        {progress.task == "" ? "No Task" : progress.task}
                    </Tag>
                    {showTipInfo()}
                    {
                        progress.task && mainstore.apiState != APIState.Sending && mainstore.apiState != APIState.Fail ?
                            <Progress
                                percent={_.round((progress.stepNow / progress.stepsWhole), 2) * 100}
                                percentPosition={{ align: 'end', type: 'inner' }}
                                size={[150, 15]}
                            // strokeColor="#001342"
                            /> : ""
                    }
                </Flex>
            )
        }
    }

    const showTipInfo = () => {
        if (mainstore.apiState == APIState.Sending) {
            return <Tag icon={<SyncOutlined spin />} color="processing" style={{ marginRight: 0 }}>
                processing
            </Tag>
        } else if (mainstore.apiState == APIState.Success) {
            // show by progress bar
            // return <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginRight: 0 }}>
            //     success
            // </Tag>
            return ""
        } else if (mainstore.apiState == APIState.Fail) {
            return <Tag icon={<CloseCircleOutlined />} color="error" style={{ marginRight: 0 }}>
                error
            </Tag>
        } else {// default: show no tip info
            return ""
        }
    }

    const showRedoUndoReset = () => {
        if (mainstore.interactions.length > 0 || mainstore.redoList.length > 0) {
            const buttonStatus = { undo: false, redo: false, reset: false }
            if (mainstore.interactions.length > 0) {
                buttonStatus.undo = true
            }
            if (mainstore.redoList.length > 0) {
                buttonStatus.undo = true
            }
            if (mainstore.resetIndicator.isReset == false) {
                buttonStatus.reset = true
            }

            return (
                <Space>
                    <Button size='small' disabled={!buttonStatus.undo} style={{ fontSize: 12, height: 20 }}>Undo</Button>
                    <Button size='small' disabled={!buttonStatus.redo} style={{ fontSize: 12, height: 20 }}>Redo</Button>
                    <Button size='small' disabled={!buttonStatus.reset} style={{ fontSize: 12, height: 20 }}>Reset</Button>
                </Space>
            )
        }
    }

    useEffect(() => {
        // Embed the chart in the #chart-container div
        vegaEmbed("#chart-container",
            toJS(mainstore.chartSpec),
            { actions: false, renderer: "svg" })
            .then(result => {
                // Access the Vega view
                const view = result.view;

                // Run the pipeline to process the data
                view.runAsync().then(() => {
                    // 1. distill the pixel coordinates of data items and put into store
                    // Extract the processed data from the "marks" dataset
                    const data = view.data('marks');
                    // console.log('Extracted data with coordinates:', data);

                    let dataItems = distillCoords(data)
                    // console.log('distilled items', dataItems);

                    // old place to store pixel coords
                    // mainstore.specification_now.data.values = dataItems

                    // new place to store pixel coordinates of data items
                    const interactUnitNow = mainstore.unitNow
                    if (interactUnitNow) {
                        interactUnitNow.chartSpec.data.values = dataItems
                    }

                    // update original spec to 
                    if (mainstore.count == 1) {
                        // have pixel coords
                        mainstore.specification_org.data.values = dataItems
                    }

                    // 2. put the scales into store
                    mainstore.xyScales = {
                        x: view.scale('x'),
                        xDomain: view.scale('x').domain(),
                        xInvert: view.scale('x').invert,
                        y: view.scale('y'),
                        yDomain: view.scale('y').domain(),
                        yInvert: view.scale('y').invert
                    }
                    // console.log(mainstore.xyScales.xInvert(2));
                    // console.log(toJS(mainstore.xyScales.xDomain));

                    // 3. get the transform info from rendered svg
                    getTransform()
                });
            })
            .catch((err) =>
                console.error(err)
            );
    }, [mainstore.update_flag]);

    const render = () => {
        return (
            <div className="chart-panel">
                <div style={{ width: 500 }}>
                    <Flex justify='space-between' align='center' style={{ width: "100%", padding: 5, marginBottom: 10 }}>
                        {showTaskProgress()}
                        {showRedoUndoReset()}
                    </Flex>
                </div>
                <div style={{ position: 'relative' }}>
                    <div id='chart-container'></div>
                    {/* the size of svg should align with and bigger than the chart mainbox */}
                    {/* overflow to make sure elements inside of svg show, to adapt to the grids for aggregation */}
                    <svg id="chart-overlay" width={400 + 80} height={300 + 80} style={{ position: 'absolute', left: mainstore.gTransform.x, top: mainstore.gTransform.y, overflow: 'visible' }}></svg>
                    <div id='chart-tooltip'></div>
                </div>
                {/* test to render with VegaLite directly */}
                {/* <VegaLite spec={toJS(mainstore.specification_current)} /> */}
                <Flex justify='center' align='flex-start' style={{ width: "100%", padding: 5 }}>
                    <div style={{ width: "60%" }}>
                        <SpeechContainerV4 mainstore={mainstore} />
                    </div>
                </Flex>
            </div>
        );
    };

    return render();
});

export const ChartContainerV3 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const codeQuickTest = () => {// test for quick functions
        // console.log("mainstore.label2ChartEncodedAttributes", mainstore.chartEncodedAttributes);

        // let attrs2Agg = 0
        // _.forEach(mainstore.chartEncodedAttributes, function (o, key) {
        //     if (o.type == "quantitative") attrs2Agg += 1
        // })
        // console.log("attrs2Agg", attrs2Agg);

        // console.log(`${Object.entries({ "x": 1, "y": 3, "category": "A" })
        //     .map(([key, item], index) => {
        //         return `${key}: ${item}`
        //     }).join("\n")}`);

        // console.log("concat", _.concat([{ x: 1 }, { x: 2 }, { x: 3 }], [[{ x: 1 }], [{ x: 4 }, { x: 5 }]].at(-1)), [[{ x: 1 }], [{ x: 4 }, { x: 5 }]].pop());
    }

    const distillCoords = (data) => {
        // FIXME: adjust labels when there are selection, label start from selected items
        let items: any = []
        if (mainstore.count == 1) {// have id for every data items
            _.forEach(data, (item, index) => {
                items.push(
                    // FIXME: avoid axis name to be x and y
                    // cause there will be conflicts to distill xy coords
                    {
                        ...item.datum,
                        xCoord: _.round(item.x, 3),
                        yCoord: _.round(item.y, 3),
                        label: (index + 1) + "",
                        id: "id" + (index + 1)
                    }
                )
            })
        } else {
            // check if there are selects, if there is, label from selected items
            if (mainstore.selectedItems.length > 0) {
                // console.log("data", data);
                // console.log("mainstore.selectedItems", toJS(mainstore.selectedItems));

                let selectedDataItems = _.filter(data, o => _.includes(mainstore.selectedItems, o.datum.id))
                let unSelectedDataItems = _.filter(data, o => !_.includes(mainstore.selectedItems, o.datum.id))
                // console.log("selectedDataItems", selectedDataItems);
                // console.log("unSelectedDataItems", unSelectedDataItems);

                data = _.concat(selectedDataItems, unSelectedDataItems)
            }

            _.forEach(data, (item, index) => {
                items.push(
                    // FIXME: avoid axis name to be x and y
                    // cause there will be conflicts to distill xy coords
                    { ...item.datum, xCoord: _.round(item.x, 3), yCoord: _.round(item.y, 3), label: (index + 1) + "" }
                )
            })
        }
        // console.log('items', items);

        return items
    }

    const getTransform = () => {
        // Use D3 to select the SVG element
        const svg = d3.select("#chart-container").select("svg");

        // Select the <g> element with the transform attribute
        const group = svg.select("g");

        // Get the transform attribute
        const transform = group.attr("transform");
        // console.log("Transform attribute:", transform);

        if (svg && group && transform) {
            // Parse the transform (e.g., translate(x, y))
            const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
            if (translateMatch) {
                const [_, x, y] = translateMatch;
                // console.log("Translate X:", x, typeof (+x));
                // console.log("Translate Y:", y);

                // put into store
                // + str: a shorthand to convert a string into a number
                mainstore.gTransform = { x: +x, y: +y }
            } else {
                console.log("No translate found in transform attribute.");
            }
        } else {
            console.log("no svg, or group, or transform found.", svg, group, transform);
        }
    }

    // update with Tag component
    const showTaskProgress = () => {
        if (mainstore.interactions.length > 0) {
            const unitNow = mainstore.unitNow

            const progress = { task: "select", stepNow: 1, stepsWhole: 2 }
            if (unitNow) {
                const task = unitNow?.task
                if (task) {
                    // update task
                    progress.task = task

                    if (unitNow.status) {
                        // adjust step whole based on task type and interact status
                        if (unitNow.status == InteractStatus.Direct) {
                            progress.stepsWhole = 1
                        } else {
                            if (task == "select") {
                                progress.stepsWhole = 3
                            }
                        }

                        // adjust step now based on interact status
                        if (unitNow.status == InteractStatus.Start) {
                            progress.stepNow = 1
                        } else if (unitNow.status == InteractStatus.Ongoing) {
                            progress.stepNow = progress.stepsWhole == 2 ? 1 : 2
                        } else if (unitNow.status == InteractStatus.End) {
                            progress.stepNow = progress.stepsWhole == 2 ? 2 : 3
                        }
                    } else {
                        console.log("No status.");
                    }
                } else {
                    console.log("No task.");
                }
            } else {
                console.log("unitNow is null.");
            }

            // draw UI to show the info
            return (
                <Flex gap={0} align='flex-start' vertical>
                    <Button color="primary" variant="text" size='small'>
                        {progress.task == "" ? "No Task" : progress.task}
                    </Button>
                    {
                        progress.task ? <Progress
                            percent={_.round((progress.stepNow / progress.stepsWhole), 2) * 100}
                            percentPosition={{ align: 'end', type: 'inner' }}
                            size={[150, 15]}
                        // strokeColor="#001342"
                        /> : ""
                    }
                    {showTipInfo()}
                </Flex>
            )
        }
    }

    const showTipInfo = () => {
        let tipInfo = () => {
            if (mainstore.apiState == APIState.Sending) {
                return 'Processing now, please wait...';
            } else if (mainstore.apiState == APIState.Success) {
                return 'Successfully processed';
            } else if (mainstore.apiState == APIState.Fail) {
                return 'Fail to process, please try again';
            } else {
                return 'test';
            }
        };

        return (
            <Spin spinning={mainstore.apiState == APIState.Sending}>
                <Alert
                    message={tipInfo()}
                    type={mainstore.apiState == APIState.Fail ? 'warning' : 'info'}
                    showIcon
                // style={{ height: 60 }}
                />
            </Spin>
        )
    }

    const showRedoUndoReset = () => {
        if (mainstore.interactions.length > 0 || mainstore.redoList.length > 0) {
            const buttonStatus = { undo: false, redo: false, reset: false }
            if (mainstore.interactions.length > 0) {
                buttonStatus.undo = true
            }
            if (mainstore.redoList.length > 0) {
                buttonStatus.undo = true
            }
            if (mainstore.resetIndicator.isReset == false) {
                buttonStatus.reset = true
            }

            return (
                <Space>
                    <Button size='small' disabled={!buttonStatus.undo}>Undo</Button>
                    <Button size='small' disabled={!buttonStatus.redo}>Redo</Button>
                    <Button size='small' disabled={!buttonStatus.reset}>Reset</Button>
                </Space>
            )
        }
    }

    useEffect(() => {
        // Embed the chart in the #chart-container div
        vegaEmbed("#chart-container",
            toJS(mainstore.chartSpec),
            { actions: false, renderer: "svg" })
            .then(result => {
                // Access the Vega view
                const view = result.view;

                // Run the pipeline to process the data
                view.runAsync().then(() => {
                    // 1. distill the pixel coordinates of data items and put into store
                    // Extract the processed data from the "marks" dataset
                    const data = view.data('marks');
                    // console.log('Extracted data with coordinates:', data);

                    let dataItems = distillCoords(data)
                    // console.log('distilled items', dataItems);

                    // old place to store pixel coords
                    // mainstore.specification_now.data.values = dataItems

                    // new place to store pixel coordinates of data items
                    const interactUnitNow = mainstore.unitNow
                    if (interactUnitNow) {
                        interactUnitNow.chartSpec.data.values = dataItems
                    }

                    // update original spec to 
                    if (mainstore.count == 1) {
                        // have pixel coords
                        mainstore.specification_org.data.values = dataItems
                    }

                    // 2. put the scales into store
                    mainstore.xyScales = {
                        x: view.scale('x'),
                        xDomain: view.scale('x').domain(),
                        xInvert: view.scale('x').invert,
                        y: view.scale('y'),
                        yDomain: view.scale('y').domain(),
                        yInvert: view.scale('y').invert
                    }
                    // console.log(mainstore.xyScales.xInvert(2));
                    // console.log(toJS(mainstore.xyScales.xDomain));

                    // 3. get the transform info from rendered svg
                    getTransform()

                    // FIXME: comment when the tool is deployed
                    // test for quick function
                    codeQuickTest()
                });
            })
            .catch((err) =>
                console.error(err)
            );
    }, [mainstore.update_flag]);

    const render = () => {
        return (
            <div className="chart-panel">
                <Flex justify='space-between' align='center' style={{ width: "100%", padding: 5, marginBottom: 10 }}>
                    {showTaskProgress()}
                    {showRedoUndoReset()}
                </Flex>
                <div style={{ position: 'relative' }}>
                    <div id='chart-container'></div>
                    {/* the size of svg should align with and bigger than the chart mainbox */}
                    {/* overflow to make sure elements inside of svg show, to adapt to the grids for aggregation */}
                    <svg id="chart-overlay" width={400 + 80} height={300 + 80} style={{ position: 'absolute', left: mainstore.gTransform.x, top: mainstore.gTransform.y, overflow: 'visible' }}></svg>
                    <div id='chart-tooltip'></div>
                </div>
                {/* test to render with VegaLite directly */}
                {/* <VegaLite spec={toJS(mainstore.specification_current)} /> */}
                <Flex justify='center' align='flex-start' style={{ width: "100%", padding: 5 }}>
                    <div style={{ width: "60%" }}>
                        <SpeechContainerV4 mainstore={mainstore} />
                    </div>
                </Flex>
            </div>
        );
    };

    return render();
});

export const ChartContainerV2 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const codeQuickTest = () => {// test for quick functions
        // console.log("mainstore.label2ChartEncodedAttributes", mainstore.chartEncodedAttributes);

        // let attrs2Agg = 0
        // _.forEach(mainstore.chartEncodedAttributes, function (o, key) {
        //     if (o.type == "quantitative") attrs2Agg += 1
        // })
        // console.log("attrs2Agg", attrs2Agg);

        // console.log(`${Object.entries({ "x": 1, "y": 3, "category": "A" })
        //     .map(([key, item], index) => {
        //         return `${key}: ${item}`
        //     }).join("\n")}`);

        // console.log("concat", _.concat([{ x: 1 }, { x: 2 }, { x: 3 }], [[{ x: 1 }], [{ x: 4 }, { x: 5 }]].at(-1)), [[{ x: 1 }], [{ x: 4 }, { x: 5 }]].pop());
    }

    const distillCoords = (data) => {
        // FIXME: adjust labels when there are selection, label start from selected items
        let items: any = []
        if (mainstore.count == 1) {// have id for every data items
            _.forEach(data, (item, index) => {
                items.push(
                    // FIXME: avoid axis name to be x and y
                    // cause there will be conflicts to distill xy coords
                    {
                        ...item.datum,
                        xCoord: _.round(item.x, 3),
                        yCoord: _.round(item.y, 3),
                        label: (index + 1) + "",
                        id: "id" + (index + 1)
                    }
                )
            })
        } else {
            // check if there are selects, if there is, label from selected items
            if (mainstore.selectedItems.length > 0) {
                // console.log("data", data);
                // console.log("mainstore.selectedItems", toJS(mainstore.selectedItems));

                let selectedDataItems = _.filter(data, o => _.includes(mainstore.selectedItems, o.datum.id))
                let unSelectedDataItems = _.filter(data, o => !_.includes(mainstore.selectedItems, o.datum.id))
                // console.log("selectedDataItems", selectedDataItems);
                // console.log("unSelectedDataItems", unSelectedDataItems);

                data = _.concat(selectedDataItems, unSelectedDataItems)
            }

            _.forEach(data, (item, index) => {
                items.push(
                    // FIXME: avoid axis name to be x and y
                    // cause there will be conflicts to distill xy coords
                    { ...item.datum, xCoord: _.round(item.x, 3), yCoord: _.round(item.y, 3), label: (index + 1) + "" }
                )
            })
        }
        // console.log('items', items);

        return items
    }

    const getTransform = () => {
        // Use D3 to select the SVG element
        const svg = d3.select("#chart-container").select("svg");

        // Select the <g> element with the transform attribute
        const group = svg.select("g");

        // Get the transform attribute
        const transform = group.attr("transform");
        // console.log("Transform attribute:", transform);

        if (svg && group && transform) {
            // Parse the transform (e.g., translate(x, y))
            const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
            if (translateMatch) {
                const [_, x, y] = translateMatch;
                // console.log("Translate X:", x, typeof (+x));
                // console.log("Translate Y:", y);

                // put into store
                // + str: a shorthand to convert a string into a number
                mainstore.gTransform = { x: +x, y: +y }
            } else {
                console.log("No translate found in transform attribute.");
            }
        } else {
            console.log("no svg, or group, or transform found.", svg, group, transform);
        }
    }

    const showTaskProgress = () => {
        const unitNow = mainstore.unitNow

        const progress = { task: "select", stepNow: 1, stepsWhole: 2 }
        if (unitNow) {
            const task = unitNow?.task
            if (task) {
                // update task
                progress.task = task

                if (unitNow.status) {
                    // adjust step whole based on task type and interact status
                    if (unitNow.status == InteractStatus.Direct) {
                        progress.stepsWhole = 1
                    } else {
                        if (task == "select") {
                            progress.stepsWhole = 3
                        }
                    }

                    // adjust step now based on interact status
                    if (unitNow.status == InteractStatus.Start) {
                        progress.stepNow = 1
                    } else if (unitNow.status == InteractStatus.Ongoing) {
                        progress.stepNow = progress.stepsWhole == 2 ? 1 : 2
                    } else if (unitNow.status == InteractStatus.End) {
                        progress.stepNow = progress.stepsWhole == 2 ? 2 : 3
                    }
                } else {
                    console.log("No status.");
                }
            } else {
                console.log("No task.");
            }
        } else {
            console.log("unitNow is null.");
        }

        // draw UI to show the info
        return (
            <Flex gap={0} align='flex-start' vertical>
                <Button color="primary" variant="text" size='small'>
                    {progress.task == "" ? "No Task" : progress.task}
                </Button>
                {
                    progress.task ? <Progress
                        percent={(progress.stepNow / progress.stepsWhole) * 100}
                        percentPosition={{ align: 'end', type: 'inner' }}
                        size={[150, 15]}
                    // strokeColor="#001342"
                    /> : ""
                }
            </Flex>
        )
    }

    const showRedoUndoReset = () => {
        const buttonStatus = { undo: false, redo: false, reset: false }
        if (mainstore.interactions.length > 0) {
            buttonStatus.undo = true
        }
        if (mainstore.redoList.length > 0) {
            buttonStatus.undo = true
        }
        if (mainstore.resetIndicator.isReset == false) {
            buttonStatus.reset = true
        }

        return (
            <Space>
                <Button size='small' disabled={!buttonStatus.undo}>Undo</Button>
                <Button size='small' disabled={!buttonStatus.redo}>Redo</Button>
                <Button size='small' disabled={!buttonStatus.reset}>Reset</Button>
            </Space>
        )
    }

    const showSpeechStatusAndUnitNow = () => {
        const unitNow = mainstore.unitNow

        if (unitNow) {

        } else {
            console.log("unitNow is null.");
        }
    }


    useEffect(() => {
        // Embed the chart in the #chart-container div
        vegaEmbed("#chart-container",
            toJS(mainstore.chartSpec),
            { actions: false, renderer: "svg" })
            .then(result => {
                // Access the Vega view
                const view = result.view;

                // Run the pipeline to process the data
                view.runAsync().then(() => {
                    // 1. distill the pixel coordinates of data items and put into store
                    // Extract the processed data from the "marks" dataset
                    const data = view.data('marks');
                    // console.log('Extracted data with coordinates:', data);

                    let dataItems = distillCoords(data)
                    // console.log('distilled items', dataItems);

                    // old place to store pixel coords
                    // mainstore.specification_now.data.values = dataItems

                    // new place to store pixel coordinates of data items
                    const interactUnitNow = mainstore.unitNow
                    if (interactUnitNow) {
                        interactUnitNow.chartSpec.data.values = dataItems
                    }

                    // update original spec to 
                    if (mainstore.count == 1) {
                        // have pixel coords
                        mainstore.specification_org.data.values = dataItems
                    }

                    // 2. put the scales into store
                    mainstore.xyScales = {
                        x: view.scale('x'),
                        xDomain: view.scale('x').domain(),
                        xInvert: view.scale('x').invert,
                        y: view.scale('y'),
                        yDomain: view.scale('y').domain(),
                        yInvert: view.scale('y').invert
                    }
                    // console.log(mainstore.xyScales.xInvert(2));
                    // console.log(toJS(mainstore.xyScales.xDomain));

                    // 3. get the transform info from rendered svg
                    getTransform()

                    // FIXME: comment when the tool is deployed
                    // test for quick function
                    codeQuickTest()
                });
            })
            .catch((err) =>
                console.error(err)
            );
    }, [mainstore.update_flag]);

    const render = () => {
        return (
            <div className="chart-panel">
                <Flex justify='space-between' align='flex-end' style={{ width: "100%", padding: 5, marginBottom: 10 }}>
                    {showTaskProgress()}
                    {showRedoUndoReset()}
                </Flex>
                <div style={{ position: 'relative' }}>
                    <div id='chart-container'></div>
                    {/* the size of svg should align with and bigger than the chart mainbox */}
                    {/* overflow to make sure elements inside of svg show, to adapt to the grids for aggregation */}
                    <svg id="chart-overlay" width={400 + 80} height={300 + 80} style={{ position: 'absolute', left: mainstore.gTransform.x, top: mainstore.gTransform.y, overflow: 'visible' }}></svg>
                    <div id='chart-tooltip'></div>
                </div>
                {/* test to render with VegaLite directly */}
                {/* <VegaLite spec={toJS(mainstore.specification_current)} /> */}
            </div>
        );
    };

    return render();
});

export const ChartContainer = observer(({ mainstore }: { mainstore: MainStore }) => {
    const distillCoords = (data) => {
        let items: any = []
        _.forEach(data, (item, index) => {
            items.push(
                { ...item.datum, xCoord: _.round(item.x, 3), yCoord: _.round(item.y, 3), label: (index + 1) + "" }
            )
        })
        // console.log('items', items);

        return items
    }

    const getTransform = () => {
        // const svg = document.querySelector("#chart-container svg");
        // if (svg) {
        //     // Find the <g> element with the transform attribute
        //     const group = svg.querySelector("g");
        //     if (group) {
        //         const transform = group.getAttribute("transform");
        //         console.log("Transform attribute:", transform);

        //         // Example: Parse the transform (e.g., translate(x, y))
        //         if (transform) {
        //             const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
        //             if (match) {
        //                 const [_, x, y] = match;
        //                 console.log("Translate X:", x);
        //                 console.log("Translate Y:", y);
        //             }
        //         } else {
        //             console.warn("No transform found.");
        //         }
        //     } else {
        //         console.warn("No <g> element found with transform attribute.");
        //     }
        // } else {
        //     console.warn("No SVG element found.");
        // }

        // Use D3 to select the SVG element
        const svg = d3.select("#chart-container").select("svg");

        // Select the <g> element with the transform attribute
        const group = svg.select("g");

        // Get the transform attribute
        const transform = group.attr("transform");
        console.log("Transform attribute:", transform);

        if (svg && group && transform) {
            // Parse the transform (e.g., translate(x, y))
            const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
            if (translateMatch) {
                const [_, x, y] = translateMatch;
                console.log("Translate X:", x, typeof (+x));
                console.log("Translate Y:", y);

                // put into store
                // + str: a shorthand to convert a string into a number
                mainstore.gTransform = { x: +x, y: +y }
            } else {
                console.log("No translate found in transform attribute.");
            }
        } else {
            console.log("no svg, or group, or transform found.", svg, group, transform);
        }
    }

    useEffect(() => {
        // const spec: any = mainstore.specification_current
        // console.log("spec", spec, JSON.parse(JSON.stringify(spec)), toJS(spec))

        // Embed the chart in the #chart-container div
        // console.log("spec", mainstore.specification_current);
        vegaEmbed("#chart-container",
            toJS(mainstore.specification_now),
            { actions: false, renderer: "svg" })
            .then(result => {
                // Access the generated SVG element
                // const svgElement = result.view.toSVG();
                // svgElement.then(svg => console.log("SVG Output:", svg));

                // Access the Vega view
                const view = result.view;
                // Run the pipeline to process the data
                view.runAsync().then(() => {
                    // Extract the processed data from the "marks" dataset
                    const data = view.data('marks');
                    // console.log('Extracted data with coordinates:', data);

                    // distill the pixel coordinates of data items and put into store
                    let dataItems = distillCoords(data)
                    console.log('distilled items', dataItems);
                    mainstore.specification_now.data.values = dataItems

                    // put the scales into store
                    // mainstore.view = view
                    mainstore.xyScales = {
                        x: view.scale('x'),
                        xInvert: view.scale('x').invert,
                        y: view.scale('y'),
                        yInvert: view.scale('y').invert
                    }

                    // const xScale = view.scale('x'); // Get the x scale
                    // const yScale = view.scale('y'); // Get the y scale
                    // console.log(xScale.invert(2), yScale(7), mainstore.xyScales.xInvert(2));

                    // get the transform info from rendered svg
                    getTransform()
                });
            })
            .catch((err) =>
                console.error(err)
            );
    }, [mainstore.update_flag]);

    const render = () => {
        return (
            <div className="chart-panel">
                {/* <Space> */}
                <div style={{ position: 'relative' }}>
                    <div id='chart-container'></div>
                    {/* <div style={{ position: 'absolute', top: 10, left: 33 }}>
                        <svg id="chart-overlay" width="400" height="300"></svg>
                    </div> */}
                    {/* the size of svg should align with and bigger than the chart mainbox */}
                    <svg id="chart-overlay" width="430" height="330" style={{ position: 'absolute', left: mainstore.gTransform.x, top: mainstore.gTransform.y }}></svg>
                    <div id='chart-tooltip'></div>
                </div>
                {/* test to render with VegaLite directly */}
                {/* <VegaLite spec={toJS(mainstore.specification_current)} /> */}
                {/* </Space> */}
            </div>
        );
    };

    return render();
});
