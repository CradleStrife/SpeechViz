import React, { useEffect, useState, Component } from 'react';
import { observer } from 'mobx-react';
import { toJS } from "mobx";
import * as _ from 'lodash';

import {
    Cell,
    drawGrid,
    drawGridAndLabel,
    drawLabel4Marks,
    generateGridCells,
    GridCell,
    highlightDataItemsByID,
    highlightDataItemsByLabel,
    highlightGridCell,
    InteractStatus,
    LabelCoord,
    selectGrid,
    // showChartTooltip,
    // executeCommand,
    handleSpeechCommand
} from '../util.tsx';
import { MainStore } from '../mainstore.tsx';
import { ScatterPlot, ScatterPlotV2, ScatterPlotV3 } from '../test/smoothTransition.tsx';

import { AudioOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Space, Card, Tag, Flex } from 'antd';
import { VegaLite } from "react-vega";
import vegaEmbed from "vega-embed";
import { testAPI } from '../llm.ts';
import * as d3 from "d3";
import { Conversation, ConversationV2, ConversationV3, ConversationV4, ConversationV5 } from './conversation.tsx';
import { SpeechContainerV2, SpeechContainerV3, SpeechContainerV4 } from './speech.tsx';
import SpeechAssistant from '../test/voice.tsx';


export const FeedbackContainerV2 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const showStatus = () => {
        if (mainstore.status == InteractStatus.SpeechOn)
            return <Tag color="#87d068">Speech On</Tag>
        else if (mainstore.status == InteractStatus.SpeechOff)
            return <Tag color="#bfbfc0">Speech Off</Tag>
        else if (mainstore.status == InteractStatus.Start)
            return <Tag color="#f50">Iterative</Tag>
    }

    const render = () => {
        return (
            <div className="feedback-panel">
                <Flex gap="small" vertical>
                    {/* {showStatus()} */}
                    {/* <Space>
                        <Button>Undo</Button>
                        <Button>Redo</Button>
                        <Button>Reset</Button>
                    </Space> */}
                    {/* <Conversation mainstore={mainstore} /> */}
                    {/* <ConversationV2 mainstore={mainstore} /> */}
                    {/* <ConversationV3 mainstore={mainstore} /> */}
                    {/* <ConversationV4 mainstore={mainstore} /> */}
                    <ConversationV5 mainstore={mainstore} />
                    {/* try with smooth transition */}
                    {/* <ScatterPlot /> */}
                    {/* <ScatterPlotV2 /> */}
                    {/* <ScatterPlotV3 /> */}
                    {/* <BarChart /> */}
                    {/* <SpeechContainerV2 mainstore={mainstore} /> */}
                    {/* <SpeechAssistant /> */}
                    {/* <SpeechContainerV3 mainstore={mainstore} /> */}
                    {/* <SpeechContainerV4 mainstore={mainstore} /> */}
                    {/* <Button onClick={() => {
                        // Test
                        executeCommand("generate grids", mainstore); // Output: Generating grids...
                        executeCommand("zoom into grid 3", mainstore); // Output: Zooming into grid 3...
                    }}>Test NL2Actions No AI</Button>
                    <Button onClick={() => {
                        // Example usage
                        handleSpeechCommand({
                            transcript: "select",
                            mainstore: mainstore
                        });
                    }}>Test NL2Actions AI</Button>
                    <Button onClick={() => {
                        console.log("before modify", toJS(mainstore.chartSpec));

                        mainstore.chartSpec.width = 666

                        console.log("after modify", toJS(mainstore.chartSpec));
                    }}>Test Mobx Get</Button> */}
                </Flex>
            </div >
        );
    };

    return render();
});

export const FeedbackContainer = observer(({ mainstore }: { mainstore: MainStore }) => {
    const showStatus = () => {
        if (mainstore.status == InteractStatus.SpeechOn)
            return <Tag color="#87d068">Speech On</Tag>
        else if (mainstore.status == InteractStatus.SpeechOff)
            return <Tag color="#bfbfc0">Speech Off</Tag>
        else if (mainstore.status == InteractStatus.Start)
            return <Tag color="#f50">Iterative</Tag>
    }

    const render = () => {
        return (
            <div className="feedback-panel">
                {/* <Space direction="vertical" align="center" size={10}> */}
                <Flex gap="small" vertical>
                    {showStatus()}
                    <Space>
                        <Button>Undo</Button>
                        <Button>Redo</Button>
                        <Button>Reset</Button>
                    </Space>
                    {/* <Conversation mainstore={mainstore} /> */}
                    <ConversationV2 mainstore={mainstore} />
                    <Button onClick={() => {
                        // Update the spec to hide/show gridlines
                        mainstore.specification_now.encoding.x.axis['grid'] = false;
                        mainstore.specification_now.encoding.y.axis['grid'] = false;

                        // Re-render the chart
                        mainstore.update_flag = !mainstore.update_flag
                    }}>Hide Chart Grids</Button>
                    <Button onClick={() => {
                        const chartOverlay = d3.select("#chart-overlay");
                        chartOverlay.style("visibility", "hidden")

                        const chartTooltip = d3.select("#chart-tooltip");
                        chartTooltip.style("visibility", "hidden")

                        // const chartOverlay = d3.select("#chart-overlay");
                        // chartOverlay.selectAll("*").remove();

                        // const chartOverlay = document.getElementById('chart-overlay');
                        // if (chartOverlay) {
                        //     chartOverlay.style.visibility = 'hidden';
                        // }

                        // const chartTooltip = document.getElementById('chart-tooltip');
                        // if (chartTooltip) {
                        //     chartTooltip.style.visibility = 'hidden';
                        // }
                    }}>Hide Overlay and Tooltip</Button>
                    <Button onClick={() => {
                        // Set up the SVG
                        const svg = d3.select("#chart-overlay");
                        svg.selectAll("*").remove();

                        // Grid configuration
                        const gridOptions = {
                            svg: svg,
                            width: +svg.attr("width"),
                            height: +svg.attr("height"),
                            // xTicks: d3.range(50, 400, 50),  // Vertical gridlines every 50px
                            xTicks: [15, 20, 50, 100],  // Vertical gridlines every 50px
                            // yTicks: d3.range(50, 300, 50),  // Horizontal gridlines every 50px
                            yTicks: [10, 20, 50, 100],  // Horizontal gridlines every 50px
                            color: "red",
                            strokeWidth: 1,
                            strokeDasharray: "2,2", // Dashed gridlines
                            horizontal: true,
                            vertical: true,
                        };

                        // Draw the grid
                        drawGrid(gridOptions);
                    }}>Generate Grids</Button>
                    <Button onClick={() => {
                        // Custom x and y coordinates for the grid
                        const xCoords = [0, 50, 170, 200, 300, 400]; // Defines column widths
                        const yCoords = [0, 130, 230, 300]; // Defines row heights
                        const xyCoords = { xCoords, yCoords }

                        // Generate grid cells based on x and y coordinates
                        const gridCells: GridCell[] = generateGridCells({ xCoords, yCoords });

                        // Set up the SVG
                        const svg = d3.select("#chart-overlay");
                        // svg.selectAll("*").remove();

                        // Grid configuration
                        const gridOptions = {
                            svg: svg,
                            xyCoords: xyCoords,
                            gridCells: gridCells,
                            color: "gray",
                            strokeWidth: 1,
                            showLabels: true, // Enable labels
                            labelStyle: { fontSize: 10, color: "blue", dx: 0, dy: 0 }
                        };

                        // Draw the grid
                        drawGridAndLabel(gridOptions);
                        // const gridCells = drawGridAndLabel(gridOptions);

                        // highlight grid cell
                        highlightGridCell({ gridCells: gridCells, labels: ['8'] })

                        // show tooltip
                        // const chartTooltip = d3.select("#chart-tooltip");
                        // const chartTooltip = document.getElementById("chart-tooltip");
                        // showChartTooltip({ tooltip: chartTooltip, gridCells: gridCells, label: '8' })
                        // console.log('chartTooltip', chartTooltip);

                        // store the data
                        mainstore.coords_now = xyCoords
                        mainstore.coords_list.push(xyCoords)
                        mainstore.gridCells_now = gridCells
                        mainstore.gridCells_list.push(gridCells)
                        console.log("mainstore", toJS(mainstore));
                    }}>Generate Grids V2</Button>
                    <Button onClick={() => {
                        const chartOverlay = d3.select("#chart-overlay");
                        selectGrid({
                            // svg: chartOverlay,
                            gridCells: mainstore.gridCells_now,
                            labels: ["4"],
                            // spec: mainstore.specification_now,
                            mainstore: mainstore
                        })
                    }}>
                        Test SelectGrid 4
                    </Button>
                    <Button onClick={() => {
                        const chartOverlay = d3.select("#chart-overlay");
                        selectGrid({
                            // svg: chartOverlay,
                            gridCells: mainstore.gridCells_now,
                            labels: ["7"],
                            // spec: mainstore.specification_now,
                            mainstore: mainstore
                        })
                    }}>
                        Test SelectGrid 7
                    </Button>
                    <Button onClick={() => {
                        // distill coordinates and create label index for labels
                        const distillCoords = (data) => {
                            let items: LabelCoord[] = []
                            _.forEach(data, (item, index) => {
                                // create label and store it
                                // items.push(
                                //     { x: item.xCoord, y: item.yCoord, label: (index + 1) + "" }
                                // )
                                // item['label'] = (index + 1) + ""

                                // label is already included in the source data
                                items.push(
                                    { x: item.xCoord, y: item.yCoord, label: item.label, id: item.id }
                                )
                            })
                            // console.log('items', items);

                            return items
                        }

                        const chartOverlay = d3.select("#chart-overlay");
                        let labelCoords = distillCoords(mainstore.specification_now.data.values)

                        drawLabel4Marks({
                            // svg: chartOverlay,
                            // labelCoords: labelCoords,
                            mainstore: mainstore,
                            labelStyle: { fontSize: 12, color: "gray", dx: 8, dy: 8 }
                        })

                        // console.log("mainstore", toJS(mainstore));
                    }}>
                        DrawLabel
                    </Button>
                    <Button onClick={() => {
                        const labels = ['1', '2', '3', '9']
                        highlightDataItemsByLabel({ labels: labels, mainstore: mainstore })

                        // Re-render the chart
                        mainstore.update_flag = !mainstore.update_flag
                    }}>
                        Highlight Item
                    </Button>
                    {/* <Button onClick={() => {
                        testAPI()
                    }}>Try API</Button> */}
                    {/* <Card size="small" title="Small size card" style={{ width: 200 }}>
                        <p>Card content</p>
                        <p>Card content</p>
                    </Card> */}
                </Flex>
                {/* </Space> */}
            </div >
        );
    };

    return render();
});
