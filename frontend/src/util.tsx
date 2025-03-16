import * as d3 from "d3";
import { MainStore } from "./mainstore";
import { toJS } from "mobx";
import * as _ from 'lodash';
import { identifySelectType, mapAndDistillSpeech2Task, mapAndDistillSpeech2TaskSV, mapSpeechToFunction, selectBySemanticLLM } from "./llm.ts";
import { enhancedData, enhancedLegendMapping } from "./test/data.tsx";

// outlidespark: define types
export type Cell = {
  no: number; // used for cell id
  id: string; // store the initial id
  cellType: string;

  isSelected: boolean;
  relation: object | undefined;
  bindToSlides: number[];

  inputs: any;
  outputs: any;

  inputLines: number;

  isChanged: boolean;

  // get from backend
  point?: string;
  alternatives?: string[];
  keywords?: string[];
};

// url base 
export const viewSize = {
  width: '1300px',
  height: '930px'
};

export const URLBase: string = 'http://127.0.0.1:5000';

// atomic functions
// callni
// FIXME: compute coordinate dynamically
export function getXYCoords() {
  // Custom x and y coordinates for the grid
  const xCoords = [0, 50, 170, 200, 300, 400]; // Defines column lines, one number for one line
  const yCoords = [0, 130, 230, 300]; // Defines row lines, one number for one line
  const xyCoords: XYCoords = { xCoords, yCoords }

  return xyCoords
}

// callni
export function createThenShowGridsAndLabels(xyCoords: XYCoords, mainstore: MainStore) {
  // Generate grid cells based on x and y coordinates
  const gridCells: GridCell[] = generateGridCells(xyCoords);

  // Set up the SVG
  const svg = d3.select("#chart-overlay");

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

  // store the data
  const interactUnitNow = mainstore.unitNow
  if (interactUnitNow) {
    interactUnitNow.labelType = LabelType.GridItem
    interactUnitNow.overlayCoords = xyCoords
    interactUnitNow.overlayGrids = gridCells
  }
}

export function drawGridAndLabel({
  svg,
  xyCoords, // may used to create lines instead of rects
  gridCells,
  color = "gray",
  strokeWidth = 1,
  showLabels = true,
  labelStyle = { fontSize: 12, color: "black", dx: 5, dy: 5 },
}: DrawGridParams): void {
  // make sure svg is not hidden
  svg.style("visibility", "visible")
  // remove inside elements before drawing new stuff
  svg.selectAll("*").remove();

  // Generate grid cells based on x and y coordinates
  // const gridCells: GridCell[] = generateGridCells({ xCoords, yCoords });
  // console.log("gridCells Data", xyCoords, gridCells);

  // Lines can be used to replace rect so as to better contorl the borders 
  // Draw grid rectangles
  svg
    .selectAll(".grid-cell")
    .data(gridCells)
    .join("rect")
    .attr("class", "grid-cell")
    .attr("x", (d) => d.x)
    .attr("y", (d) => d.y)
    .attr("width", (d) => d.width)
    .attr("height", (d) => d.height)
    .attr("fill", "none") // Transparent fill
    // .attr("stroke", color)
    .attr("stroke", Colors.GridStroke)
    .attr("stroke-width", strokeWidth);

  // Add grid labels if enabled
  if (showLabels) {
    svg
      .selectAll(".item-label")
      .data(gridCells)
      .join("text")
      .attr("class", "item-label")
      .attr("x", (d) => d.x + d.width / 2 + labelStyle.dx) // Center label in cell
      .attr("y", (d) => d.y + d.height / 2 + labelStyle.dy)
      // .attr("fill", labelStyle.color)
      .attr("fill", Colors.Label)
      .attr("font-size", labelStyle.fontSize)
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .text((d) => d.label);
  }

  // return gridCells;
}

// FIXME: delete? abandoned
export function drawGrid({
  svg,
  width,
  height,
  xTicks,
  yTicks,
  color = "gray",
  strokeWidth = 1,
  strokeDasharray = "0,0",
  horizontal = true,
  vertical = true,
  showLabels = false,
  labelStyle = { fontSize: 12, color: "black", dx: -5, dy: -5 }
}) {
  // Draw horizontal gridlines and labels
  if (horizontal) {
    const horizontalLines = svg.selectAll(".grid-line-horizontal")
      .data(yTicks)
      .join("line")
      .attr("class", "grid-line-horizontal")
      .attr("x1", 0)
      .attr("x2", width)
      .attr("y1", d => d)
      .attr("y2", d => d)
      .attr("stroke", color)
      .attr("stroke-width", strokeWidth)
      .attr("stroke-dasharray", strokeDasharray);

    if (showLabels) {
      svg.selectAll(".grid-label-horizontal")
        .data(yTicks)
        .join("text")
        .attr("class", "grid-label-horizontal")
        .attr("x", labelStyle.dx) // Label offset on the x-axis
        .attr("y", d => d + labelStyle.dy) // Label position on the y-axis
        .attr("fill", labelStyle.color)
        .attr("font-size", labelStyle.fontSize)
        .text(d => d); // Label text is the tick value
    }
  }

  // Draw vertical gridlines and labels
  if (vertical) {
    const verticalLines = svg.selectAll(".grid-line-vertical")
      .data(xTicks)
      .join("line")
      .attr("class", "grid-line-vertical")
      .attr("x1", d => d)
      .attr("x2", d => d)
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", color)
      .attr("stroke-width", strokeWidth)
      .attr("stroke-dasharray", strokeDasharray);

    if (showLabels) {
      svg.selectAll(".grid-label-vertical")
        .data(xTicks)
        .join("text")
        .attr("class", "grid-label-vertical")
        .attr("x", d => d + labelStyle.dx) // Label position on the x-axis
        .attr("y", height + labelStyle.dy) // Label offset on the y-axis (below the grid)
        .attr("fill", labelStyle.color)
        .attr("font-size", labelStyle.fontSize)
        .attr("text-anchor", "middle")
        .text(d => d); // Label text is the tick value
    }
  }
}

// callni
// highlight and zoom to selected grid cells
export function selectGrid({ labels, gridCells, mainstore }: {
  labels: string[];
  gridCells: GridCell[];
  mainstore: MainStore
}) {
  // highlight the selected grid
  // FIXME: sometimes grids are not nearby, highlighting needs fixing
  highlightGridCell({ labels, gridCells })

  // hide grids
  setTimeout(() => {
    switchSVGOverlay(false)

    const interactUnitNow = mainstore.unitNow
    // const interactUnitNow = mainstore.interactions.at(-1)

    const cells: GridCell[] = _.filter(gridCells, d => _.includes(labels, d.label));
    if (interactUnitNow && cells) {
      // find the left and right border for x
      // find the top and bottom border for y
      let cell = { x1: cells[0].x, x2: cells[0].x + cells[0].width, y1: cells[0].y, y2: cells[0].y + cells[0].height }
      _.forEach(cells, o => {
        if (o.x < cell.x1) cell.x1 = o.x
        if ((o.x + o.width) > cell.x2) cell.x2 = o.x + o.width
        if (o.y < cell.y1) cell.y1 = o.y
        if ((o.y + o.height) > cell.y2) cell.y2 = o.y + o.height
      });
      // let xDomain = [3, 6]
      // let yDomain = [5, 8]
      let xDomain = [mainstore.xyScales.xInvert(cell.x1), mainstore.xyScales.xInvert(cell.x2)]
      let yDomain = [mainstore.xyScales.yInvert(cell.y2), mainstore.xyScales.yInvert(cell.y1)]
      console.log("domains", xDomain, yDomain);

      // adjust the spec
      filterData(interactUnitNow.chartSpec, xDomain, yDomain)
      adjustScale(interactUnitNow.chartSpec, xDomain, yDomain)

      // track the changes
      console.log("mainstore.unitNow", toJS(mainstore.unitNow));

      // domain needs last xy scale before re-redering, 
      // while labels for marks need new pixel coords after re-rendering
      mainstore.update_flag = !mainstore.update_flag
      setTimeout(() => {
        drawLabel4Marks({
          mainstore: mainstore,
          labelStyle: { fontSize: 12, color: "gray", dx: 8, dy: 8 }
        })
      }, 30)
    } else {
      console.log("interactUnitNow is null or no matching grid cells.");
    }
  }, 1000);
}

// callni
export function selectMarkLabels(labels: string[], mainstore: MainStore) {
  if (mainstore.unitNow) {
    // let ids = locateIDByLabel(labels, mainstore.chartSpec.data.values)
    let ids = locateIDByLabel(labels, mainstore.interactions.at(-2)?.chartSpec.data.values)
    console.log("locateIDByLabel", ids);
    mainstore.unitNow.selectedDataItem = ids

    // update global selected items 
    updateSelectedItems({ mainstore })
    ids = mainstore.selectedItems

    switchSVGOverlay(false)
    zoomBack4Iterate(mainstore)
    highlightDataItemsByID({ ids: ids, mainstore: mainstore })
    switchChartGrids(true, mainstore)
  }
}

//spec changed
export function zoomBack4Iterate(mainstore: MainStore) {
  console.log("intertNow", JSON.parse(JSON.stringify(mainstore.interactNow)));

  const interactUnitEnd = mainstore.interactNow.at(-1)
  const interactUnitStart = mainstore.interactNow.at(0)

  if (interactUnitEnd && interactUnitStart) {
    interactUnitEnd.chartSpec = interactUnitStart.chartSpec
    console.log("zoomBack4Iterate spec", toJS(interactUnitEnd));
  } else {
    console.log("interactUnitEnd or interactUnitStart is null.");
  }
}

//spec changed
export function highlightDataItemsByLabel({ labels, mainstore }: {
  labels: string[];
  mainstore: MainStore;
}) {
  const interactUnitNow = mainstore.interact_now.at(-1)
  const interactUnitStart = mainstore.interact_now.at(0)

  if (interactUnitNow && interactUnitStart) {
    // const spec = mainstore.specification_now
    const spec = interactUnitNow.chartSpec
    console.log("highlightDataItemsByLabel in spec", toJS(spec));

    // 1. build params for highlight
    const param = {
      "name": "highlightList",
      "value": labels
    }
    const params = [param]

    // // 2. check how many channels
    // const keys = _.keys(spec.encoding)
    // // FIXME: there may be other channels
    // const channels = _.interserction(keys, ['x', 'y', 'color'])
    // if (channels.length == 2) {
    // } else if (channels.length == 3) {
    // } else {
    //   console.log(`too many channels: ${channels.length}`);
    // }

    // 3. create conditional encoding using opacity channel
    const opacityEncoding = {
      "condition": {
        "test": "indexof(highlightList, datum.label) >= 0",
        "value": 1
      },
      "value": 0.3
    }

    // 4. update spec to have conditional encoding
    spec['params'] = params
    spec.encoding['opacity'] = opacityEncoding
    console.log("highlightDataItemsByLabel out spec", toJS(spec));
  } else {
    console.log("interactUnitNow or interactUnitStart is null.");
  }
}

// NL to atomic actions: LLM-powered (speech-2-interact version)
// not merge map and distill
// export async function handleSpeechCommand({ transcript, mainstore }: { transcript: string, mainstore: MainStore }) {
//   // const startTime = performance.now();

//   const result = await mapSpeechToFunction(transcript);
//   if (result && atomicActions[result.function]) {
//     // Call the function with parameters
//     // atomicActions[result.function](result.params || {}); 
//     atomicActions[result.function]({ transcript: transcript, labels: result.params.labels == undefined ? [] : result.params.labels, mainstore: mainstore });

//     // update task info into store
//     if (mainstore.unitNow) {
//       mainstore.unitNow.task = result.function
//     }
//     // console.log("unitNow", toJS(mainstore.unitNow));
//   } else {
//     console.log("Command not recognized or no matching function.");
//   }

//   // const endTime = performance.now();
//   // console.log(`Duration: ${((endTime - startTime) / 1000).toFixed(2)} s`);
// }

// merge map and distill
export async function handleSpeechCommand({ transcript, mainstore }: { transcript: string, mainstore: MainStore }) {
  // const startTime = performance.now();
  // reset for new commands
  // reset api state 
  mainstore.apiState = APIState.Default
  // reset isCommandSupporte
  mainstore.isCommandSupported = true

  // to call llm 
  // update api state
  mainstore.apiState = APIState.Sending
  // put task into llm to save time
  const task = mainstore.nextTask == "" ? "null" : mainstore.nextTask
  // FIXME: uncomment when calling LLM
  const result = await mapAndDistillSpeech2Task(transcript, task);
  // reset task to "", the value can be changed while executing task functions
  mainstore.nextTask = ""

  // testing for reset
  // const result = {
  //   "task": "reset",// reset
  //   "params": {
  //   }
  // }

  // testing for undo, redo
  // mainstore.interactions = testInteractions
  // mainstore.redoList = testRedoList
  // const result = {
  //   "task": "redo",// undo, redo
  //   "params": {
  //   }
  // }

  // testing for select
  // mainstore.selectedItems = ['id1', 'id2', 'id3', 'id4']
  // const result = {
  //   "task": "select",
  //   "params": {
  //     "type": "Unselect", // Grid, Semantic, Unselect
  //     // "labels": ["1", "2", "3", "4"]
  //     "labels": ["1", "2", "3"]
  //     // "labels": []
  //   }
  // }

  // testing for show details
  // mainstore.selectedItems = ['id1', 'id2', 'id3', 'id4']
  // const result = {
  //   "task": "detail",
  //   "params": {
  //     "type": "showDetail", // showDetail, hideDetail
  //     "labels": ["3", "2", "1"], // only show the first item
  //     // "labels": [],
  //   }
  // }

  // testing for highlight
  // mainstore.highlightIndicator.isHighlight = false
  // mainstore.selectedItems = ['id1', 'id2', 'id3', 'id4', 'id15']
  // const result = {
  //   "task": "highlight",
  //   "params": {
  //     "type": "Highlight", // Highlight, UndoHighlight
  //   }
  // }

  // testing for change color
  // mainstore.changeColorIndicator.isOneStep = true
  // const result = {
  //   "task": "change",
  //   "params": {
  //     "type": "ChangeColor", // ChangeColor
  //     "color": 'red',
  //     // "color": 'reds',
  //     // "color": '',
  //   }
  // }

  // testing for aggregate
  // mainstore.aggregationIndicator.attribute = "x"
  // mainstore.aggregationIndicator.operation = "mean"
  // const result = {
  //   "task": "aggregate",
  //   "params": {
  //     "type": "UndoAggregate", // UndoAggregate, Aggregate
  //     // "labels": ["1"],
  //     "labels": [],
  //     "attribute": 'y',
  //     // "attribute": '',
  //     // "operator": "Sum"
  //     "operator": ""
  //   }
  // }

  // testing for pan
  // mainstore.selectedItems = ['id1', 'id2', 'id3', 'id4', '1d15']
  // const result = {
  //   "task": "pan",
  //   "params": {
  //     "type": "PanOut",
  //     // "labels": ["1", "2", "3", "4"],
  //     // "labels": ["6"],
  //     "labels": [],
  //     // "position": '1',
  //     "position": '',
  //   }
  // }

  // testing for zoom
  // mainstore.selectedItems = ['id1', 'id2', 'id3', 'id4']
  // const result = {
  //   "task": "zoom",
  //   "params": {
  //     "type": "ZoomOut",
  //     // "labels": ["1", "2", "3", "4"],
  //     "labels": ["1", "2"],
  //     // "labels": [],
  //     // "position": '1',
  //     "position": '',
  //   }
  // }

  // testing for filter
  // mainstore.selectedItems = ['id1', 'id2', 'id3', 'id4']
  // const result = {
  //   "task": "filter",
  //   "params": {
  //     "type": "Remove",
  //     // "labels": ["1", "2", "3", "4"]
  //     "labels": ["1", "2", "3"]
  //     // "labels": []
  //   }
  // }

  if (result && result.task && atomicActions[result.task]) {
    // update api state
    mainstore.apiState = APIState.Success

    // update task info into store
    if (mainstore.unitNow) {
      mainstore.unitNow.task = result.task
    }

    // Call the function with parameters
    // atomicActions[result.task]({ transcript: transcript, labels: result.params.labels == undefined ? [] : result.params.labels, mainstore: mainstore });
    atomicActions[result.task]({ transcript: transcript, params: result.params == undefined ? {} : result.params, mainstore: mainstore });

    // clear redo for new task: check the task, if not redo (pop out from list) or undo (set into list), clear redo
    if (mainstore.redoList.length > 0 && result.task != 'undo' && result.task != 'redo') {
      mainstore.redoList = []
    }
    // console.log("task", task, result.task);
    // console.log("redoList after task execution: ", toJS(mainstore.redoList));

    // set reset indiactor for new task
    if (task != 'reset') {
      mainstore.resetIndicator.isReset = false
    }

    // console.log("unitNow", toJS(mainstore.unitNow));
  } else {
    console.log("Command not recognized or no matching function.");
    console.log("llm result: ", result);
    mainstore.apiState = APIState.Fail
    mainstore.isCommandSupported = false
  }

  if (mainstore.isCommandSupported == false) {
    const responseText = `"Sorrry! ${transcript}" is not working. Please try other commands.`
    createTextResponseBySystem({ responseText, mainstore })
  }

  console.log("interactions", toJS(mainstore.interactions));
  // const endTime = performance.now();
  // console.log(`Duration: ${((endTime - startTime) / 1000).toFixed(2)} s`);
}

const atomicActions = {
  temp: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Filtering ...`)
    const actionType = params.type
    const labels = params.labels

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      unitNow.subType = actionType
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
  select: async ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    // console.log("Selecting ...")
    const actionType = params.type // previously was distilled by the following function
    // const result = await identifySelectType(transcript);
    // console.log("identifySelectType", result);
    let labels = params.labels

    if (actionType) {
      if (actionType == "Unselect") {
        removeSelect({ transcript, mainstore })
      } else {
        if (actionType == "Grid") {
          // to handle commands like: select all (for grids and data items)
          // if this is not working, may create a type when calling LLM
          if (transcript.toLowerCase().includes("all")) {
            const unitNow = mainstore.unitNow
            const unitLast = mainstore.interactions.at(-2)

            if (unitNow && unitLast) {
              let labelsTemp: string[] = []

              if (unitLast.labelType == LabelType.GridItem) {// handle for grids
                _.forEach(unitLast.overlayGrids, (item, index) => {
                  labelsTemp.push(item.label)
                })
              } else if (unitLast.labelType == LabelType.DataItem) {// handle for data items
                _.forEach(unitLast.chartSpec.data.values, (item, index) => {
                  labelsTemp.push(item.label)
                })
              }

              labels = labelsTemp
            }
          } else {
            console.log("unitNow or unitLast is null.")
          }

          selectElements({ labels: labels, mainstore: mainstore })
        } else if (actionType == "Semantic") {
          await selectBySemantic({ transcript, mainstore })
        }

        // update selected items -> have bug, merge with every function that update selected items 
        // deal with previous unselected items:
        // 1. add a status field
        // 2. document status when selecting and unselecting
        // 3. filter by status
        // updateSelectedItems({ mainstore })

        // // highlight based on selected items
        // highlightDataItemsByID({ ids: mainstore.selectedItems, mainstore: mainstore })
        // // if sepc is changed, re-render the chart
        // mainstore.update_flag = !mainstore.update_flag
      }
    }

    // console.log("unitNow", toJS(mainstore.unitNow));
    // console.log("selectedItems", toJS(mainstore.selectedItems));
  },
  filter: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Filtering ...`)
    console.log(`selected items: `, toJS(mainstore.selectedItems))
    const actionType = params.type
    let labels = params.labels

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: subType
      unitNow.subType = actionType

      if (actionType == "Focus" || actionType == "Remove") {// filter type
        if (mainstore.selectedItems.length > 0) {// has selection
          // to handle commands like: focus and remove all
          // if this is not working, may create a type when calling LLM
          if (transcript.toLowerCase().includes("all")) {
            let labelsTemp: string[] = []
            _.forEach(unitNow.chartSpec.data.values, (item, index) => {
              if (_.includes(mainstore.selectedItems, item.id)) {
                labelsTemp.push(item.label)
              }
            })

            labels = labelsTemp
          }

          if (labels.length > 0) {// filter with labels
            // check last unit to see if this filter is multi-step
            if (unitLast && unitLast.status == InteractStatus.Start) {// multi step: select labels first then filter
              // 1. update unit: index, subIndex, status 
              unitNow.index = countTemp
              unitNow.subIndex = unitLast.subIndex != undefined ? unitLast.subIndex + 1 : 1
              unitNow.status = InteractStatus.End

              // store selected labels in both last and now unit
              unitNow.selectedLabel = labels
              unitLast.selectedLabel = labels

              // end of the task, count++
              mainstore.count += 1
            } else {// one step: filter firectly with labels
              // 2. update unit: index, subIndex, status 
              unitNow.index = countTemp
              unitNow.subIndex = 1
              unitNow.status = InteractStatus.Direct

              // store selected labels only in now unit
              unitNow.selectedLabel = labels

              // end of the task, count++
              mainstore.count += 1
            }

            // 3. filter with labels
            // check if labels have been drawn
            const svg = d3.select("#chart-overlay");
            let duration = 0
            if (svg.selectAll(".item-label").empty()) {// no lables be drawn
              drawLabel4TargetMarks({
                ids: mainstore.selectedItems,
                mainstore: mainstore,
                labelStyle: { fontSize: 12, color: "gray", dx: 8, dy: 8 }
              })

              duration = 1
            }

            setTimeout(() => {
              filterByLabels({
                actType: unitNow.subType ? unitNow.subType : "",
                labels: labels,
                mainstore: mainstore
              })
            }, duration * 1000)
          } else {// create labels for lable-based filter (multi-step filter)
            // 1. update unit: index, subIndex, status
            unitNow.index = countTemp
            unitNow.subIndex = 1
            unitNow.status = InteractStatus.Start

            // update mainstore to inform the next task
            mainstore.nextTask = "filter"

            // 2. create labels for selected items
            drawLabel4TargetMarks({
              ids: mainstore.selectedItems,
              mainstore: mainstore,
              labelStyle: { fontSize: 13, color: "gray", dx: 8, dy: 8 }
            })

            // re-render: if sepc is changed, re-render the chart
            mainstore.update_flag = !mainstore.update_flag
          }
        } else {// no selection
          // 1. inform user
          // FIXME: sometimes there will be several system responses
          const responseText = `"These is no selected items. Please select first.`
          createTextResponseBySystem({ responseText, mainstore })

          // FIXME: connect to select directly or not
          // currently: connect to select
          // 2. update the task to select
          unitNow.task = "select"

          // 3. update unit: index, subIndex, steps, status, labelType
          unitNow.index = countTemp
          unitNow.subIndex = 1
          unitNow.status = InteractStatus.Start
          // not the end of task cause I set the task to select now
          // mainstore.count += 1

          // 4. create grids for select task
          createGrids4Selection({ mainstore })

          // re-render: if sepc is changed, re-render the chart
          mainstore.update_flag = !mainstore.update_flag
        }
      } else if (actionType == "Unfilter") {// undo filter type
        // 1. undo last filter
        undoLastFilter({ mainstore })

        // re-render: if sepc is changed, re-render the chart
        mainstore.update_flag = !mainstore.update_flag
      } else {
        console.log("no matching filter type.");
        mainstore.isCommandSupported = false
      }
    } else {
      console.log("unitNow is null.");
    }
  },
  zoom: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Zooming ...`)
    const actionType = params.type
    let labels = params.labels
    const position = params.position

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      unitNow.subType = actionType

      //act based on task type
      if (actionType == "ZoomIn") {
        // check if the extent of zoom
        const numOfDataItems = unitNow.chartSpec.data.values ? unitNow.chartSpec.data.values.length : 0
        // console.log("numOfDataItems", numOfDataItems);
        if (numOfDataItems < 10) {// no need to zoom in, too few items
          // update unit: index, subIndex, status
          unitNow.index = countTemp
          unitNow.subIndex = 1
          unitNow.status = InteractStatus.Direct
          // end of the task, count++
          mainstore.count += 1

          // inform the user
          const responseText = `"No need to zoom further. Please try other commands.`
          createTextResponseBySystem({ responseText, mainstore })

          console.log("No need to zoom further.");
        } else {
          // check one step or multi-step
          if (position != "") {// zoom one-step
            // replace label with the position value
            labels = [position]

            // update unit: index, subIndex, status
            unitNow.index = countTemp
            unitNow.subIndex = 1
            unitNow.status = InteractStatus.Direct
            // end of the task, count++
            mainstore.count += 1

            // update unit: store labels
            unitNow.labelType = LabelType.GridItem
            unitNow.selectedLabel = labels

            // update unit: isZoomClear
            unitNow.isZoomClear = false

            // zoom into grid function
            // // check if grids have been drawn cause highlight is needed
            // const svg = d3.select("#chart-overlay");
            // let duration = 0
            // if (svg.selectAll(".grid-cell").empty()) {// no lables be drawn
            //   createGrids4Navigation({ mainstore })
            //   duration = 1
            // }
            // setTimeout(() => {
            //   zoomIntoGrids({
            //     labels: labels,
            //     margin: 0.2,
            //     mainstore: mainstore
            //   })
            // }, duration * 1000)

            // FIXME: zoom into grid function: 
            // not zoom in completly to selected grids, 
            // leave some margins
            zoomIntoGrids({
              labels: labels,
              margin: 0.2,
              mainstore: mainstore
            })
          } else {// zoom multi-step
            // check if there are selections
            if (mainstore.selectedItems.length > 0) {// has selection
              if (labels.length > 0) {// mark labels are selected
                // update unit: index, subIndex, status
                unitNow.index = countTemp
                unitNow.subIndex = 2
                unitNow.status = InteractStatus.End
                // end of the task, count++
                mainstore.count += 1

                // update unit: store labels
                unitNow.labelType = LabelType.DataItem
                unitNow.selectedLabel = labels

                // update unit: isZoomClear
                unitNow.isZoomClear = false

                // FIXME: highlight selected labels: may check if labels have been drawn
                // transfer labels to ids
                let ids = locateIDByLabel(labels, unitNow.chartSpec.data.values)
                console.log(`locateIDByLabel: ${unitNow.subType} on ids (${ids})`);
                // highlight mark labels by ids
                highlightLabelsbyIds({ ids: ids })

                // compute zoom grids based on selected mark labels
                let gridLables = getNaviGridLabelByDataIds({ ids: ids, mainstore: mainstore })

                // FIXME: call zoom into grid function
                // // check if grids have been drawn cause highlight is needed in function zoomIntoGrids
                // const svg = d3.select("#chart-overlay");
                // let duration = 0
                // if (svg.selectAll(".grid-cell").empty()) {// no lables be drawn
                //   createGrids4Navigation({ mainstore })
                //   duration = 1
                // }
                // setTimeout(() => {
                //   zoomIntoGrids({
                //     labels: gridLables,
                //     margin: 0.2,
                //     mainstore: mainstore
                //   })
                // }, duration * 1000)

                // set a timer to make sure label highlighting shown
                setTimeout(() => {
                  zoomIntoGrids({
                    labels: gridLables,
                    margin: 0.2,
                    mainstore: mainstore
                  })
                }, 1 * 1000)
              } else {// draw labels for selected marks
                // update unit: index, subIndex, status
                unitNow.index = countTemp
                unitNow.subIndex = 1
                unitNow.status = InteractStatus.Start

                // update mainstore to inform the next task
                mainstore.nextTask = "zoom"

                drawLabel4TargetMarks({
                  ids: mainstore.selectedItems,
                  mainstore: mainstore,
                  labelStyle: { fontSize: 12, color: "gray", dx: 8, dy: 8 }
                })
              }
            } else {// no selection
              if (labels.length > 0) {// grid labels are selected
                // update unit: index, subIndex, status
                unitNow.index = countTemp
                unitNow.subIndex = 2
                unitNow.status = InteractStatus.End
                // end of the task, count++
                mainstore.count += 1

                // update unit: store labels
                unitNow.labelType = LabelType.GridItem
                unitNow.selectedLabel = labels

                // update unit: isZoomClear
                unitNow.isZoomClear = false

                // FIXME: call zoom into grid function
                zoomIntoGrids({
                  labels: labels,
                  margin: 0.2,
                  mainstore: mainstore
                })
              } else {// draw grids for navigation
                // update unit: index, subIndex, status
                unitNow.index = countTemp
                unitNow.subIndex = 1
                unitNow.status = InteractStatus.Start

                // update mainstore to inform the next task
                mainstore.nextTask = "zoom"

                createGrids4Navigation({ mainstore })
              }
            }

            // to handle commands like: zoom into all
            // check if user selects all labels, 
            // if it is, inform users no need, and re-select
            if (transcript.toLowerCase().includes("all")) {
              // update unit: index, subIndex, status
              unitNow.index = countTemp
              unitNow.subIndex = unitLast?.subIndex ? unitLast?.subIndex + 1 : 2
              unitNow.status = InteractStatus.Ongoing

              // update mainstore to inform the next task
              mainstore.nextTask = "zoom"

              // inform the user
              const responseText = `"Make no sense to zoom into all. Please zoom into some position.`
              createTextResponseBySystem({ responseText, mainstore })

              console.log("Zoom into all.");
            }
          }
        }
      } else if (actionType == "ZoomOut") {
        // update unit: index, subIndex, status
        unitNow.index = countTemp
        unitNow.subIndex = 1
        unitNow.status = InteractStatus.Direct
        // end of the task, count++
        mainstore.count += 1

        // check last zoom in
        // if exist: act
        // if no: inform user
        undoLastZoomIn({ mainstore })
      } else {
        console.log("no matching zoom type.");
        mainstore.isCommandSupported = false
      }
    } else {
      console.log("unitNow is null.");
    }
  },
  pan: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Paning ...`)
    const actionType = params.type
    let labels = params.labels
    const position = params.position

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      unitNow.subType = actionType

      // act based on task type
      if (actionType == "PanIn") {
        // check if the extent of zoom
        const numOfDataItems = unitNow.chartSpec.data.values ? unitNow.chartSpec.data.values.length : 0
        // console.log("numOfDataItems", numOfDataItems);
        if (numOfDataItems < 10) {// no need to zoom in, too few items
          // update unit: index, subIndex, status
          unitNow.index = countTemp
          unitNow.subIndex = 1
          unitNow.status = InteractStatus.Direct
          // end of the task, count++
          mainstore.count += 1

          // inform the user
          const responseText = `"No need to pan further. Please try other commands.`
          createTextResponseBySystem({ responseText, mainstore })

          console.log("No need to pan further.");
        } else {
          // check one step or multi-step
          if (position != "") {// zoom one-step
            // replace label with the position value
            labels = [position]

            // update unit: index, subIndex, status
            unitNow.index = countTemp
            unitNow.subIndex = 1
            unitNow.status = InteractStatus.Direct
            // end of the task, count++
            mainstore.count += 1

            // update unit: store labels
            unitNow.labelType = LabelType.GridItem
            unitNow.selectedLabel = labels

            // update unit: isZoomClear
            unitNow.isPanClear = false

            // FIXME: zoom into grid function: 
            // not zoom in completly to selected grids, 
            // leave some margins
            panIntoGrids({
              labels: labels,
              margin: 0.2,
              mainstore: mainstore
            })
          } else {// zoom multi-step
            // check if there are selections
            if (mainstore.selectedItems.length > 0) {// has selection
              if (labels.length > 0) {// mark labels are selected
                // update unit: index, subIndex, status
                unitNow.index = countTemp
                unitNow.subIndex = 2
                unitNow.status = InteractStatus.End
                // end of the task, count++
                mainstore.count += 1

                // update unit: store labels
                unitNow.labelType = LabelType.DataItem
                unitNow.selectedLabel = labels

                // update unit: isZoomClear
                unitNow.isPanClear = false

                // FIXME: highlight selected labels: may check if labels have been drawn
                // transfer labels to ids
                let ids = locateIDByLabel(labels, unitNow.chartSpec.data.values)
                console.log(`locateIDByLabel: ${unitNow.subType} on ids (${ids})`);
                // highlight mark labels by ids
                highlightLabelsbyIds({ ids: ids })

                // compute zoom grids based on selected mark labels
                let gridLables = getNaviGridLabelByDataIds({ ids: ids, mainstore: mainstore })

                // FIXME: call zoom into grid function
                // set a timer to make sure mark label highlighting shown
                setTimeout(() => {
                  panIntoGrids({
                    labels: gridLables,
                    margin: 0.2,
                    mainstore: mainstore
                  })
                }, 1 * 1000)
              } else {// draw labels for selected marks
                // update unit: index, subIndex, status
                unitNow.index = countTemp
                unitNow.subIndex = 1
                unitNow.status = InteractStatus.Start

                // update mainstore to inform the next task
                mainstore.nextTask = "pan"

                drawLabel4TargetMarks({
                  ids: mainstore.selectedItems,
                  mainstore: mainstore,
                  labelStyle: { fontSize: 12, color: "gray", dx: 8, dy: 8 }
                })
              }
            } else {// no selection
              if (labels.length > 0) {// grid labels are selected
                // update unit: index, subIndex, status
                unitNow.index = countTemp
                unitNow.subIndex = 2
                unitNow.status = InteractStatus.End
                // end of the task, count++
                mainstore.count += 1

                // update unit: store labels
                unitNow.labelType = LabelType.GridItem
                unitNow.selectedLabel = labels

                // update unit: isZoomClear
                unitNow.isPanClear = false

                // FIXME: call zoom into grid function
                panIntoGrids({
                  labels: labels,
                  margin: 0.2,
                  mainstore: mainstore
                })
              } else {// draw grids for navigation
                // update unit: index, subIndex, status
                unitNow.index = countTemp
                unitNow.subIndex = 1
                unitNow.status = InteractStatus.Start

                // update mainstore to inform the next task
                mainstore.nextTask = "pan"

                createGrids4Navigation({ mainstore })
              }
            }

            // to handle commands like: zoom into all
            // check if user selects all labels, 
            // if it is, inform users no need, and re-select
            if (transcript.toLowerCase().includes("all")) {
              // update unit: index, subIndex, status
              unitNow.index = countTemp
              unitNow.subIndex = unitLast?.subIndex ? unitLast?.subIndex + 1 : 2
              unitNow.status = InteractStatus.Ongoing

              // update mainstore to inform the next task
              mainstore.nextTask = "pan"

              // inform the user
              const responseText = `"Make no sense to pan into all. Please pan into some position.`
              createTextResponseBySystem({ responseText, mainstore })

              console.log("Pan into all.");
            }
          }
        }
      } else if (actionType == "PanOut") {
        // update unit: index, subIndex, status
        unitNow.index = countTemp
        unitNow.subIndex = 1
        unitNow.status = InteractStatus.Direct
        // end of the task, count++
        mainstore.count += 1

        // check last zoom in
        // if exist: act
        // if no: inform user
        undoLastPanIn({ mainstore })
      } else {
        console.log("no matching pan type.");
        mainstore.isCommandSupported = false
      }
    } else {
      console.log("unitNow is null.");
    }
  },
  aggregate: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Aggregating ...`)
    const actionType = params.type
    let aggAttribute = params.attribute
    const labels = params.labels
    const aggOperator = params.operator

    // map label to attribute: make sure label is correctly mapped to fields
    if (labels.length > 0) {
      if (labels[0] == "1")
        aggAttribute = mainstore.chartEncodedAttributes['x'].field
      else if (labels[0] == "2")
        aggAttribute = mainstore.chartEncodedAttributes['y'].field
      else if (labels[0] == "3")
        aggAttribute = mainstore.chartEncodedAttributes['color'].field
    }

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      unitNow.subType = actionType
      if (actionType == "Aggregate") {
        // check if there are attibutes to aggregate
        let attrs2AggCount: number = 0
        _.forEach(mainstore.chartEncodedAttributes, function (o, key) {
          if (o.type == "quantitative") attrs2AggCount += 1
        })
        if (attrs2AggCount > 0) {// can aggregate
          if (aggAttribute != "" && aggOperator != "") {// one step: aggregate directly
            // update aggregationIndicator
            mainstore.aggregationIndicator.attribute = aggAttribute
            mainstore.aggregationIndicator.operation = aggOperator

            // update unit: index, subIndex, status
            unitNow.index = countTemp
            unitNow.subIndex = 1
            unitNow.isAggregateClear = false
            unitNow.status = InteractStatus.Direct
            // end of the task, count++
            mainstore.count += 1

            // FIXME: call updateSpec2Aggregate
            updateSpec2Aggregate({ labels, mainstore })
          } else if (aggAttribute != "") {// two steps: aggregate iteratively
            // update aggregationIndicator
            mainstore.aggregationIndicator.attribute = aggAttribute

            if (mainstore.aggregationIndicator.operation != "") {// end
              // update unit: index, subIndex, status
              unitNow.index = countTemp
              unitNow.subIndex = 2
              unitNow.isAggregateClear = false
              unitNow.status = InteractStatus.End
              // end of the task, count++
              mainstore.count += 1

              // FIXME: call updateSpec2Aggregate
              updateSpec2Aggregate({ labels, mainstore })
            } else {// begin
              // update unit: index, subIndex, status
              unitNow.index = countTemp
              unitNow.subIndex = 1
              unitNow.status = InteractStatus.Start

              // update mainstore to inform the next task
              mainstore.nextTask = "aggregate"

              // FIXME: highlight operate attr
              highlightAggregateAttribute({ labels, mainstore })

              // FIXME: inform the user to show operations in chat
              const responseText = `"Please choose the aggregate operator, e.g., sum, mean, min, max, count.`
              createTextResponseBySystem({ responseText, mainstore })
            }
          } else if (aggOperator != "" || aggAttribute == "") {// two steps: aggregate iteratively, deal with operation exist or aggregation not exist
            // update aggregationIndicator
            mainstore.aggregationIndicator.operation = aggOperator

            if (mainstore.aggregationIndicator.attribute != "") {// end
              // update unit: index, subIndex, status
              unitNow.index = countTemp
              unitNow.subIndex = 2
              unitNow.isAggregateClear = false
              unitNow.status = InteractStatus.End
              // end of the task, count++
              mainstore.count += 1

              // FIXME: call updateSpec2Aggregate
              updateSpec2Aggregate({ labels, mainstore })
            } else {// begin
              // update unit: index, subIndex, status
              unitNow.index = countTemp
              unitNow.subIndex = 1
              unitNow.status = InteractStatus.Start

              // update mainstore to inform the next task
              mainstore.nextTask = "aggregate"

              // FIXME: show grids on chart, 
              // and inform the user attributes in chat
              guide2SelectAggregationAttibute({ mainstore })
            }
          } else {
            console.log("no matching cases for aggregation.");
            mainstore.isCommandSupported = false
          }
        } else {// no attribute to act
          // update unit: index, subIndex, status
          unitNow.index = countTemp
          unitNow.subIndex = 1
          unitNow.status = InteractStatus.Direct
          // end of the task, count++
          mainstore.count += 1

          // inform the user
          const responseText = `"No attributes to aggregate. Please try other commands.`
          createTextResponseBySystem({ responseText, mainstore })

          console.log("No attributes to aggregate.");
        }
      } else if (actionType == "UndoAggregate") {// FIXME: undo aggregate
        undoLastAggregate({ mainstore })
      } else {
        console.log("no matching aggregation type.");
        mainstore.isCommandSupported = false
      }
    } else {
      console.log("unitNow is null.");
    }
  },
  change: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Changing ...`)
    const actionType = params.type
    const color = params.color

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      unitNow.subType = actionType

      if (color != "") {// has color
        // update unit: index, subIndex, status
        unitNow.index = countTemp

        // check one step or multistep
        if (mainstore.changeColorIndicator.isOneStep == false) {// multi step
          unitNow.subIndex = 2
          unitNow.status = InteractStatus.End
        } else {// one step
          unitNow.subIndex = 1
          unitNow.status = InteractStatus.Direct
        }

        // end of the task, count++
        mainstore.count += 1

        // FIXME: change color
        changeTask_AdjustColor({ color, mainstore })
      } else {// no color
        // update unit: index, subIndex, status
        unitNow.index = countTemp
        unitNow.subIndex = 1
        unitNow.status = InteractStatus.Start

        // mark change color type in store
        mainstore.changeColorIndicator.isOneStep = false

        // update mainstore to inform the next task
        mainstore.nextTask = "change"

        // FIXME: inform users to choose a color
        let recommendedColors: string[] = []
        if (mainstore.colorChannel.hasChannel && mainstore.colorChannel.field != "") {// color channel exist
          if (mainstore.colorChannel.type == "quantitative") {
            recommendedColors = ['blues', 'reds', 'magma']
          } else if (mainstore.colorChannel.type == "nominal") {
            recommendedColors = ['category10', 'tableau10']
          } else {
            recommendedColors = ['blues', 'reds', 'magma', 'category10', 'tableau10']
          }
        } else {// no color channel
          recommendedColors = ['red', 'blue', 'green', 'pink', 'organge']
        }
        const responseText = `"Please choose a color scheme, e.g., ${recommendedColors.join(", ")}.`
        createTextResponseBySystem({ responseText, mainstore })
      }
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }

    // console.log("change color unitNow: ", toJS(unitNow));
    // console.log("change color colorChannel: ", toJS(mainstore.colorChannel));
  },
  highlight: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Highlighting ...`)
    const actionType = params.type

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      unitNow.subType = actionType
      // update unit: index, subIndex, status
      unitNow.index = countTemp
      unitNow.subIndex = 1
      unitNow.status = InteractStatus.Direct
      // end of the task, count++
      mainstore.count += 1

      if (actionType == "Highlight") {// highlight
        if (mainstore.highlightIndicator.isHighlight == false) {// highlight
          if (mainstore.selectedItems.length > 0) {// has selects, do highlighting
            // mark highlight in store
            mainstore.highlightIndicator.isHighlight = true

            // FIXME: highlight selected items
            // highlight using ids
            highlightDataItemsByID({ ids: mainstore.selectedItems, mainstore: mainstore })

            // if sepc is changed, re-render the chart
            mainstore.update_flag = !mainstore.update_flag
          } else {// no select
            // inform the user
            const responseText = `"No selected items. Please select first.`
            createTextResponseBySystem({ responseText, mainstore })

            console.log("No selected items. Please select first.");
          }
        } else {// inform: already highlight
          // inform the user
          const responseText = `"Selected items are already highlighed.`
          createTextResponseBySystem({ responseText, mainstore })

          console.log("Selected items are already highlighed.");
        }
      } else if (actionType == "UndoHighlight") {// undo highlight
        if (mainstore.highlightIndicator.isHighlight == true) {// undo
          // mark highlight in store
          mainstore.highlightIndicator.isHighlight = false

          // FIXME: undo
          removeHighlightDataItems({ mainstore })

          // if sepc is changed, re-render the chart
          mainstore.update_flag = !mainstore.update_flag
        } else {// inform: no highlights to undo
          // inform the user
          const responseText = `"No highlight to undo. Please try other commands.`
          createTextResponseBySystem({ responseText, mainstore })

          console.log("No highlight to undo. Please try other commands.");
        }
      } else {
        mainstore.isCommandSupported = false
        console.log("No matching type for highligh.");
      }
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }

    // console.log("highlight unitNow: ", toJS(unitNow));
  },
  detail: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Showing details ...`)
    const actionType = params.type
    const labels = params.labels

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      unitNow.subType = actionType

      if (actionType == "ShowDetail") {
        if (mainstore.selectedItems.length > 0) {// has selects
          if (labels.length > 0) {// end of task: has labels
            // update unit: index, subIndex, status
            unitNow.index = countTemp
            unitNow.subIndex = 2
            unitNow.status = InteractStatus.End
            // end of the task, count++
            mainstore.count += 1

            // mark show detail in store
            mainstore.detailIndicator.isDetailShown = true

            // FIXME:
            let ids = locateIDByLabel(labels, unitNow.chartSpec.data.values)
            // highlight selected labels, hide mark labels
            // show details
            showTooltip4Detail({ ids, mainstore })

            // spec no change, no need to re-render
          } else {// start task: no label
            // update unit: index, subIndex, status
            unitNow.index = countTemp
            unitNow.subIndex = 1
            unitNow.status = InteractStatus.Start

            // update mainstore to inform the next task
            mainstore.nextTask = "detail"

            // mark show detail in store
            mainstore.detailIndicator.isDetailShown = false

            // FIXME:
            // hide detail
            switchTooltipOverlay(false)
            // show labels
            drawLabel4TargetMarks({
              ids: mainstore.selectedItems,
              mainstore: mainstore,
              labelStyle: { fontSize: 13, color: "gray", dx: 8, dy: 8 }
            })

            // spec no change, no need to re-render
          }
        } else {// no selects
          // update unit: index, subIndex, status
          unitNow.index = countTemp
          unitNow.subIndex = 1
          unitNow.status = InteractStatus.Direct
          // end of the task, count++
          mainstore.count += 1

          // inform user to select first
          const responseText = `"No selected items. Please select first.`
          createTextResponseBySystem({ responseText, mainstore })
          console.log("No selected items. Please select first.");
        }
      } else if (actionType == "HideDetail") {
        // update unit: index, subIndex, status
        unitNow.index = countTemp
        unitNow.subIndex = 1
        unitNow.status = InteractStatus.Direct
        // end of the task, count++
        mainstore.count += 1

        if (mainstore.detailIndicator.isDetailShown == true) {
          // mark show detail in store
          mainstore.detailIndicator.isDetailShown = false

          //FIXME: hide detail
          switchTooltipOverlay(false)
        } else {
          // inform user: no details to hide
          const responseText = `"No details to hide. Please try other commands.`
          createTextResponseBySystem({ responseText, mainstore })
          console.log("No details to hide. Please try other commands.");
        }
      } else {
        // update unit: index, subIndex, status
        unitNow.index = countTemp
        unitNow.subIndex = 1
        unitNow.status = InteractStatus.Direct
        // end of the task, count++
        mainstore.count += 1

        mainstore.isCommandSupported = false
        console.log("No matching detail type.");
      }
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
  undo: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Undoing ...`)

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: index, subIndex, status
      unitNow.index = countTemp
      unitNow.subIndex = 1
      unitNow.status = InteractStatus.Direct

      // locate the last task whoes is not undo and redo, and get the starting unit
      const lastUndoIndex = _.findLastIndex(mainstore.interactions, function (u: InteractUnit) {
        if (u.task && u.task != 'undo' && u.task != 'redo'
          && (u.status == InteractStatus.Start
            || u.status == InteractStatus.Direct)
        ) {
          return true
        } else {
          return false
        }
      })
      if (lastUndoIndex == -1) {// inform users: nothing to undo
        const responseText = `"No tasks to undo. Please try other commands.`
        createTextResponseBySystem({ responseText, mainstore })
        console.log("No tasks to undo. Please try other commands.");
      } else {// undo task
        const lastUndoUnit = mainstore.interactions[lastUndoIndex]

        // set spec to the unit before the task
        if ((lastUndoIndex - 1) > -1) {// has unit before the undo task
          unitNow.chartSpec = _.cloneDeep(mainstore.interactions[lastUndoIndex - 1].chartSpec)
        } else {// no unit in the list
          // set spec to the org spec
          unitNow.chartSpec = _.cloneDeep(mainstore.specification_org)
        }

        // put into redolist as a whole
        const lastTaskUnits = _.filter(mainstore.interactions, function (u: InteractUnit) {
          return u.index == lastUndoUnit.index
        })
        mainstore.redoList.push(lastTaskUnits)
        // console.log("undo task: ", JSON.parse(JSON.stringify(lastTaskUnits)));
        // console.log("redoList before removing: ", toJS(mainstore.redoList));

        // remove last task units from the interactions list
        _.remove(mainstore.interactions, u => u.index == lastUndoUnit.index)
        // console.log("redoList after removing: ", toJS(mainstore.redoList));

        // re-rendexr: if sepc is changed, re-render the chart
        mainstore.update_flag = !mainstore.update_flag
      }

      // end of the task, count++
      mainstore.count += 1
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
  redo: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Redoing ...`)

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: index, subIndex, status
      unitNow.index = countTemp
      unitNow.subIndex = 1
      unitNow.status = InteractStatus.Direct

      if (mainstore.redoList.length > 0) {// redo
        // move units from redolist to interactions
        // console.log(toJS(mainstore.redoList.at(-1)), toJS(mainstore.interactions));
        mainstore.interactions = _.concat(mainstore.interactions, mainstore.redoList.at(-1))
        // console.log(toJS(mainstore.interactions));

        // remove the last task units from redolist
        mainstore.redoList.pop()

        // re-rendexr: if sepc is changed, re-render the chart
        mainstore.update_flag = !mainstore.update_flag
      } else {// inform nothing to redo
        const responseText = `"No tasks to redo. Please try other commands.`
        createTextResponseBySystem({ responseText, mainstore })
        console.log("No tasks to redo. Please try other commands.");
      }

      // end of the task, count++
      mainstore.count += 1
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
  reset: ({ transcript, params, mainstore }: { transcript: string; params: any, mainstore: MainStore }) => {
    console.log(`Resetting ...`)

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: index, subIndex, status
      unitNow.index = countTemp
      unitNow.subIndex = 1
      unitNow.status = InteractStatus.Direct
      // end of the task, count++
      mainstore.count += 1

      if (mainstore.resetIndicator.isReset == false) {
        // set reset indicator
        mainstore.resetIndicator.isReset = true

        // reset to org spec
        unitNow.chartSpec = mainstore.specification_org

        // hide svg overlay
        switchSVGOverlay(false)
      } else {// inform the user: already reset
        const responseText = `"The chart is already reset. Please try other commands.`
        createTextResponseBySystem({ responseText, mainstore })
        console.log("The chart is already reset. Please try other commands.");
      }
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
};

export const atomicActionDefs = {
  select: {
    def: "select or unselect data items.",
    params: `
    param 1: type.
    if the command is similar to "unselect", mark the type as "Unselect"; 
    if the command is similar to "select" or "select 1" (1 is a number label) or "select all", mark the type as "Grid"; 
    if others, mark the type as "Semantic".

    param 2: labels.
    the labels are in the format of number.
    `,
    example: {
      command: "select 1 and 2",
      format: {
        "task": "select",
        "params": { "type": "Grid", "labels": ['1', '2'] }
      }
    }
  },
  filter: {
    def: "filter or unfilter data items.",
    params: `
    param 1: type.
    if the command is similar to "filter" or "focus on 1 and 5" (1 and 5 are number labels), mark the type as "Focus"; 
    if the command is similar to "remove" or "remove 1 to 5", mark the type as "Remove"; 
    if the command is similar to "undo filter or unfilter", mark the type as "Unfilter".

    param 2: labels.
    the labels are in the format of number.
    `,
    example: {
      command: "filter 1 to 3",
      format: {
        "task": "filter",
        "params": { "type": "Focus", "labels": ['1', '2', '3'] }
      }
    }
  },
  zoom: {
    def: "zoom in to specific area of the chart or zoom out.",
    params: `
    param 1: type.
    if the command is similar to "zoom" or "zoom into 1 and 2" (1 and 2 are number labels) or "zoom to the top right area", mark the type as "ZoomIn"; 
    if the command is similar to "zoom out" or "unzoom", mark the type as "ZoomOut"; 

    param 2: labels.
    the labels are in the format of number.

    param 3: position.
    if the command points to "top left", mark the position as '1';
    if the command points to "top", mark the position as '2';
    if the command points to "top right", mark the position as '3';
    if the command points to "left", mark the position as '4';
    if the command points to "center", mark the position as '5';
    if the command points to "right", mark the position as '6';
    if the command points to "bottom left", mark the position as '7';
    if the command points to "bottom", mark the position as '8';
    if the command points to "bottom right", mark the position as '9';
    `,
    example: {
      command: "zoom to the top right",
      format: {
        "task": "zoom",
        "params": { "type": "ZoomIn", "labels": [], "position": '2' }
      }
    }
  },
  pan: {
    def: "pan to specific area of the chart or pan out.",
    params: `
    param 1: type.
    if the command is similar to "pan" or "pan into 1 and 2" (1 and 2 are number labels) or "pan to the top right", mark the type as "PanIn"; 
    if the command is similar to "pan out" or "unpan", mark the type as "PanOut"; 

    param 2: labels.
    the labels are in the format of number.

    param 3: position.
    if the command points to "top left", mark the position as '1';
    if the command points to "top", mark the position as '2';
    if the command points to "top right", mark the position as '3';
    if the command points to "left", mark the position as '4';
    if the command points to "center", mark the position as '5';
    if the command points to "right", mark the position as '6';
    if the command points to "bottom left", mark the position as '7';
    if the command points to "bottom", mark the position as '8';
    if the command points to "bottom right", mark the position as '9';
    `,
    example: {
      command: "pan to top left",
      format: {
        "task": "pan",
        "params": { "type": "PanIn", "labels": [], "position": '1' }
      }
    }
  },
  // FIXME: hard to distill attributes when using attribute name (avoid attribute name = channel), and channel like x and y and color
  // todo: include the attributes in the prompt
  // done: map channel to label
  aggregate: {
    def: "change data aggregation level.",
    params: `
    param 1: type (string).
    if the command is similar to "show the average value on 1" (1 is a number label) or "aggregate on x" (x is encoding channel) or "show the max value" (max is the aggregation operator), mark the type as "Aggregate"; 
    if the command is similar to "remove aggregate" or "undo aggregate", mark the type as "UndoAggregate"; 

    param 2: labels (string list).
    the labels are in the format of number or channel name, such as x, y, color, and shape.
    if it's channel name, map x to 1, y to 2, color to 3, shape to 4.

    param 3: attribute (string).
    the attribute is the target of the aggregation operation.

    param 4: operator (string).
    the operator is the common aggregation operator, such as mean, min, max, count, sum.
    if the operator doesn't belong to the common ones, map it to the most relevant one.
    `,
    example: {
      command: "show the average value on 2",
      format: {
        "task": "aggregate",
        "params": { "type": "Aggregate", "labels": ['2'], "attribute": '', "operator": "mean" }
      }
    }
  },
  change: {
    def: "change the color of the marks.",
    params: `
    param 1: type (string).
    if the command is similar to "change color" or "change color to blues" (blues is a color scheme) or "change color to red" (red is a color), mark the type as "ChangeColor"; 

    param 2: color (string).
    map the color to most relevant color (i.e., red, blue, green, pink, organge) or color schemes (i.e., blues, reds, magma, category10, tableau10). 
    `,
    example: {
      command: "change color to reds",
      format: {
        "task": "change",
        "params": { "type": "ChangeColor", "color": 'reds' }
      }
    }
  },
  highlight: {
    def: "highlight selected marks.",
    params: `
    param 1: type (string).
    if the command is similar to "highlight" or "highlight selected", mark the type as "Highlight"; 
    if the command is similar to "undo highlight" or "unhighlight selected items", mark the type as "UndoHighlight"; 
    `,
    example: {
      command: "highlight selected items",
      format: {
        "task": "highlight",
        "params": { "type": "Highlight" }
      }
    }
  },
  detail: {
    def: "show details of the selected items.",
    params: `
    param 1: type (string).
    if the command is similar to "show details" or "details of 1 and 2" (1 and 2 are number labels), mark the type as "ShowDetail"; 
    if the command is similar to "hide details" or "undo show detail", mark the type as "HideDetail"; 

    param 2: labels (string list).
    the labels are in the format of number, such as 1, 2, 3.
    `,
    example: {
      command: "show details of 1 and 3",
      format: {
        "task": "detail",
        "params": { "type": "ShowDetail", "labels": ['1', '3'] }
      }
    }
  },
  undo: {
    def: "undo the last task.",
    params: `no params to distill.`,
    example: {
      command: "undo the last task",
      format: {
        "task": "undo",
        "params": {}
      }
    }
  },
  redo: {
    def: "redo the last task.",
    params: `no params to distill.`,
    example: {
      command: "redo the last task",
      format: {
        "task": "redo",
        "params": {}
      }
    }
  },
  reset: {
    def: "reset the chart to its initial status.",
    params: `no params to distill.`,
    example: {
      command: "reset the chart",
      format: {
        "task": "reset",
        "params": {}
      }
    }
  },
};

// ----------- select task -----------
export function updateSelectedItems({ mainstore }: { mainstore: MainStore }) {
  // Filter units where selectedDataItem is a non-empty array
  const selectRelatedUnits = mainstore.interactions.filter(unit => {
    if (unit.selectedDataItem != undefined && unit.isSelected == true && unit.selectedDataItem.length > 0) return true
    else return false
  })
  console.log("filtered units", JSON.parse(JSON.stringify(selectRelatedUnits)));

  let selectedItems = []// ids of the selected data items
  selectRelatedUnits.forEach(unit => selectedItems = _.concat(selectedItems, unit.selectedDataItem))
  // get unique values from the list
  selectedItems = _.uniq(selectedItems)
  console.log("track selectedItems", selectedItems);

  // update info into store
  mainstore.selectedItems = selectedItems
}

export function selectElements({ labels, mainstore }: { labels: string[], mainstore: MainStore }) {
  const unitNow = mainstore.interactions.at(-1)
  const unitLast = mainstore.interactions.at(-2)
  const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

  const labelCount = labels.length

  if (unitNow) {
    if (labelCount == 0) {// init a selection
      // update unit: index, subIndex, steps, status, labelType
      unitNow.index = countTemp
      unitNow.subIndex = 1
      // unitNow.steps = 1
      unitNow.status = InteractStatus.Start
      mainstore.count += 1

      // replace with a function (cause it will be used elsewhere)
      // // check generate grids or data labels
      // const labelType = checkLabelType({ unit: unitNow, mainstore: mainstore })
      // unitNow.labelType = labelType

      // if (labelType == LabelType.GridItem) {// generate grids
      //   // 1. hide chart grids
      //   switchChartGrids(false, mainstore)
      //   // 2. generate grids
      //   const xyCoords = getXYCoords()
      //   createThenShowGridsAndLabels(xyCoords, mainstore)
      // } else if (labelType == LabelType.DataItem) {// generate data labels
      //   drawLabel4Marks({
      //     mainstore: mainstore,
      //     labelStyle: { fontSize: 12, color: "gray", dx: 8, dy: 8 }
      //   })

      //   // already updated above
      //   // update label type cause label for data items are drawn
      //   // unitNow.labelType = LabelType.DataItem
      // }
      createGrids4Selection({ mainstore })

      // if sepc is changed, re-render the chart
      mainstore.update_flag = !mainstore.update_flag
    } else {// proceed the selection (multi-step): use label to navigate
      if (unitLast) {// last status is start
        if (unitLast.labelType == LabelType.GridItem) {
          // deal with grid label
          // update unit: index, subIndex, steps, status, selectedLabel
          unitNow.index = unitLast.index
          unitNow.subIndex = unitLast.subIndex ? unitLast.subIndex + 1 : 1
          // unitNow.steps = unitLast.steps ? unitLast.steps + 1 : 1
          unitNow.status = InteractStatus.Ongoing

          // set the selected labels to last unit
          unitLast.selectedLabel = labels

          // 3. select grids: 
          // highlight selected grids
          // hide grids
          // zoom in
          // and draw mark labels
          const gridCells = unitLast.overlayGrids
          if (gridCells) {
            selectGrid({
              labels: labels,
              gridCells: gridCells,
              mainstore: mainstore
            })

            // update label type cause label for data items are drawn
            unitNow.labelType = LabelType.DataItem
          } else {
            console.log("gridCells is null.");
          }
        } else if (unitLast.labelType == LabelType.DataItem) {
          // deal with data item label
          // update unit: index, subIndex, steps, status, selectedLabel
          unitNow.index = unitLast.index
          unitNow.subIndex = unitLast.subIndex ? unitLast.subIndex + 1 : 1
          // unitNow.steps = unitLast.steps ? unitLast.steps + 1 : 1
          unitNow.status = InteractStatus.End
          unitNow.isSelected = true

          // set the selected labels to last unit
          unitLast.selectedLabel = labels

          // 4. select labels:
          // hide mark labels
          // zoom back
          // highlight selected
          // show chart grid
          selectMarkLabels(labels, mainstore)

          // if sepc is changed, re-render the chart
          mainstore.update_flag = !mainstore.update_flag
        }
      }
    }
  } else {
    console.log("No interaction yet.");
  }
}

export async function selectBySemantic({ transcript, mainstore }: { transcript: string, mainstore: MainStore }) {
  const unitNow = mainstore.interactions.at(-1)
  // const unitLast = mainstore.interactions.at(-2)
  const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

  if (unitNow) {
    // locate items by LLM
    let selectItems = await selectBySemanticLLM(transcript, JSON.stringify(mainstore.unitNow?.chartSpec.data.values))
    // store ids
    unitNow.selectedDataItem = selectItems.ids
    unitNow.isSelected = true
    // console.log("selectItems", selectItems, selectItems.ids);

    // update unit: index, subIndex, steps, status, labelType
    unitNow.index = countTemp
    unitNow.subIndex = 1
    // unitNow.steps = 1
    // FIXME: status = Direct or End is equal
    unitNow.status = InteractStatus.Direct
    mainstore.count += 1

    // update selected items 
    updateSelectedItems({ mainstore })

    // highlight using ids
    highlightDataItemsByID({ ids: mainstore.selectedItems, mainstore: mainstore })

    // if sepc is changed, re-render the chart
    mainstore.update_flag = !mainstore.update_flag
  } else {
    console.log("No interaction yet.");
  }
}

export function removeSelect({ transcript, mainstore }: { transcript: string, mainstore: MainStore }) {
  const unitNow = mainstore.unitNow

  if (unitNow) {
    if (mainstore.selectedItems.length > 0) {
      // ToEnhance: simple implementation now, may enable grid+semantic based de-selection
      mainstore.selectedItems = []
      mainstore.interactions.forEach(unit => {
        if (unit.isSelected)
          unit.isSelected = false
      })

      // remove highlight
      removeHighlightDataItems({ mainstore: mainstore })
      // if sepc is changed, re-render the chart
      mainstore.update_flag = !mainstore.update_flag
    } else {
      // inform user to select first
      const responseText = `"No selected items to unselect.`
      createTextResponseBySystem({ responseText, mainstore })
      console.log("No selected items to unselect.");
    }
  } else {
    mainstore.isCommandSupported = false
    console.log("unitNow is null.");
  }
}

function checkLabelType({ unit, mainstore }: { unit: InteractUnit, mainstore: MainStore }) {
  let dataItems = unit.chartSpec.data.values
  // ToEnhance: djust the number later in store directly
  if (dataItems.length >= mainstore.selectIndicator.numberOfDataItems4Grid) {
    return LabelType.GridItem
  } else {
    return LabelType.DataItem
  }
}

// same to function selectElements when labels.length == 0
function createGrids4Selection({ mainstore }: { mainstore: MainStore }) {
  const unitNow = mainstore.unitNow

  if (unitNow) {
    // check generate grids or data labels
    const labelType = checkLabelType({ unit: unitNow, mainstore: mainstore })
    unitNow.labelType = labelType

    if (labelType == LabelType.GridItem) {// generate grids
      // 1. hide chart grids
      switchChartGrids(false, mainstore)
      // 2. generate grids
      const xyCoords = getXYCoords()
      createThenShowGridsAndLabels(xyCoords, mainstore)
    } else if (labelType == LabelType.DataItem) {// generate data labels
      drawLabel4Marks({
        mainstore: mainstore,
        labelStyle: { fontSize: 12, color: "gray", dx: 8, dy: 8 }
      })

      // already updated above
      // update label type cause label for data items are drawn
      // unitNow.labelType = LabelType.DataItem
    }
  } else {
    console.log("unitNow is null.");
  }
}

// ----------- filter task -----------
function filterByLabels({ actType, labels, mainstore }: { actType: string, labels: string[], mainstore: MainStore }) {
  const unitNow = mainstore.unitNow

  if (unitNow) {
    // 1. transfer labels to ids
    let ids = locateIDByLabel(labels, unitNow.chartSpec.data.values)
    console.log(`filterByLabels: ${unitNow.subType} on ids (${ids})`);

    // 2. highlight mark labels by ids
    highlightLabelsbyIds({ ids: ids })

    // 3. hide labels with a timer
    // 4. act: 
    // remove data items by ids (consider actType)
    // update unit: set isFilterClear to false

    // hide grids
    setTimeout(() => {
      switchSVGOverlay(false)

      // decide what data to keep based on actType
      const currentData = unitNow.chartSpec.data.values
      let removeIds: string[] = []
      if (unitNow.subType == "Focus") {
        _.forEach(currentData, (item, index) => {
          let flag = _.includes(ids, item.id)
          if (flag == false) removeIds.push(item.id)
        })
      } else {
        removeIds = ids
      }

      // filtered data is not updated to store if code like below
      // const filterData = filterDataByIds({ ids: removeIds, data: currentData })

      // update unit: remained items, removed item ids
      // console.log("before modify unitNow: ", toJS(unitNow));
      unitNow.chartSpec.data.values = unitNow.chartSpec.data.values.filter(d =>
        !_.includes(removeIds, d.id))
      // unitNow.chartSpec.data.values = filterData
      unitNow.filteredDataItems = removeIds
      unitNow.isFilterClear = false
      // console.log("after modify unitNow: ", toJS(unitNow));

      // re-rendexr: if sepc is changed, re-render the chart
      mainstore.update_flag = !mainstore.update_flag
    }, 1000);
  } else {
    console.log("unitNow is null.");
  }
}

function drawLabel4TargetMarks({// draw labels for assigned data items
  ids,
  labelStyle = { fontSize: 12, color: "#4169E1", dx: 8, dy: 8 },
  mainstore
}: { ids: string[]; labelStyle: LabelStyle; mainstore: MainStore; }): void {
  const svg = d3.select("#chart-overlay");
  // make sure svg is not hidden
  svg.style("visibility", "visible")
  // remove inside elements before drawing new stuff
  svg.selectAll("*").remove();

  // get coords for labels 
  const labelCoords: LabelCoord[] = distillMarkLabelCoordsByIds(ids, mainstore)

  // Add labels
  svg
    .selectAll(".item-label")
    .data(labelCoords)
    .join("text")
    .attr("class", "item-label")
    .attr("x", (d) => d.x + labelStyle.dx) // Center label in cell
    .attr("y", (d) => d.y + labelStyle.dy)
    // .attr("fill", labelStyle.color)
    .attr("fill", Colors.Label)
    .attr("font-size", labelStyle.fontSize)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .text((d) => d.label);
}

const distillMarkLabelCoordsByIds = (ids: string[], mainstore: MainStore) => {
  let items: LabelCoord[] = []

  const interactUnitNow = mainstore.unitNow
  if (interactUnitNow) {
    const data = interactUnitNow.chartSpec.data.values
    _.forEach(data, (item, index) => {
      if (_.includes(ids, item.id)) {
        items.push(
          { id: item.id, label: item.label, x: item.xCoord, y: item.yCoord }
        )
      }
    })
  }

  // console.log('distillMarkLabelCoordsByIds', items);
  return items
}

function highlightLabelsbyIds({ ids }: {
  ids: string[];
}) {
  // Set up the SVG
  const svg = d3.select("#chart-overlay");

  let flag = false
  svg.selectAll(".item-label")
    .filter(d => {
      let includeTemp = _.includes(ids, d.id)
      if (includeTemp) flag = true
      return includeTemp
    })
    .attr("fill", Colors.LabelHighlight)

  if (flag == false) {
    console.log("No matching labels to highlight.");
  }
}

// remove data items by ids
export function filterDataByIds({ ids, data }: { ids: string[], data: any }) {
  // filteredData contaims what to keep
  let filteredData = data.filter(d =>
    !_.includes(ids, d.id)
  );
  console.log("filterDataByIds", JSON.parse(JSON.stringify(filteredData)));

  return filterData
}

function undoLastFilter({ mainstore }: { mainstore: MainStore }) {
  const unitNow = mainstore.unitNow

  // 1. locate the unit before the last filter
  const lastUnitIndex = _.findLastIndex(mainstore.interactions, function (unit: InteractUnit) {
    return unit.task == 'filter'
      && unit.isFilterClear == false
      && (unit.status == InteractStatus.End || unit.status == InteractStatus.Direct);
  })
  const lastUnit = mainstore.interactions.at(lastUnitIndex)

  let actionFlag = true
  if (unitNow && lastUnit && lastUnitIndex > -1) {
    let unitBeforeSpec: any

    // get the spec before the filter
    if (lastUnitIndex == 0) {// deal with if filter in is the first interact
      unitBeforeSpec = mainstore.specification_org
    } else {// if there is a unit before the filter unit
      unitBeforeSpec = mainstore.interactions.at(lastUnitIndex - 1)?.chartSpec
    }

    // 2. adjust the current spec based on the old spec: only adjust data
    // unitNow.chartSpec = unitBeforeFilter?.chartSpec
    unitNow.chartSpec.data.values = unitBeforeSpec.data.values

    // 3. update unit: set isfilterclear =  true
    lastUnit.isFilterClear = true
  } else {
    actionFlag = false
  }

  if (actionFlag == false) {// no filter to act
    // inform the user
    const responseText = `"No filter to undone. Please try other commands.`
    createTextResponseBySystem({ responseText, mainstore })

    console.log("No filter to undone.");
  }
}

// ----------- zoom task -----------
function createGrids4Navigation({ mainstore }: { mainstore: MainStore }) {
  // 1. hide chart grids
  switchChartGrids(false, mainstore)

  // 2. generate grids
  const xCoords = [0, 133, 267, 400];
  const yCoords = [0, 100, 200, 300];
  const xyCoords: XYCoords = { xCoords, yCoords }

  createThenShowGridsAndLabels4Navigation(xyCoords, mainstore)
}

// this function is very similar to createThenShowGridsAndLabels
export function createThenShowGridsAndLabels4Navigation(xyCoords: XYCoords, mainstore: MainStore) {
  const unitNow = mainstore.unitNow

  if (unitNow) {
    // Generate grid cells based on x and y coordinates
    const gridCells: GridCell[] = generateGridCells(xyCoords);

    // newly added
    if (unitNow.task == "pan") {
      _.forEach(gridCells, function (o: GridCell) {
        o.label = numberToIconDirection[+o.label]
      })
    }

    // Set up the SVG
    const svg = d3.select("#chart-overlay");

    // Grid configuration
    const gridOptions = {
      svg: svg,
      xyCoords: xyCoords,
      gridCells: gridCells,
      color: "gray",
      strokeWidth: 1,
      showLabels: true, // Enable labels
      labelStyle: { fontSize: 13, color: "blue", dx: 0, dy: 0 }
    };

    // Draw the grid
    drawGridAndLabel(gridOptions);

    // store the data
    unitNow.labelType = LabelType.GridItem
    unitNow.overlayCoords = xyCoords
    unitNow.overlayGrids = gridCells
  } else {
    console.log("unitNow is null.");
  }
}

// map number labels into directions
const numberToIconDirection = {
  1: "↖ 1", // Top Left
  2: "↑ 2", // Top
  3: "↗ 3", // Top Right
  4: "← 4", // Left
  5: "•", // Center
  6: "→ 6", // Right
  7: "↙ 7", // Bottom Left
  8: "↓ 8", // Bottom
  9: "↘ 9", // Bottom Right
};

function getNaviGridLabelByDataIds({ ids, mainstore }: { ids: string[], mainstore: MainStore }) {
  const unitNow = mainstore.unitNow
  const unitLast = mainstore.interactions.at(-2)

  let gridLabels: string[] = []
  // if (unitNow && unitLast) {
  //   // locate data items by labels from unitLast
  //   let targetDataItems = unitLast.chartSpec.data.values.filter(d =>
  //     _.includes(labels, d.label)
  //   );

  // FIXME: unitNow also have the data in unitLast, 
  // uncomment above lines to use unitLast
  if (unitNow) {
    // locate data items by labels from unitLast
    let targetDataItems = unitNow.chartSpec.data.values.filter(d =>
      _.includes(ids, d.id)
    );

    // check which grids these data items are into
    // makes sure each data items belongs to one grid
    _.forEach(targetDataItems, (o) => {
      _.find(mainstore.navigationGrids, function (naviItem: GridCell) {
        let isInGrid = false
        if (o.xCoord >= naviItem.x && o.xCoord <= (naviItem.x + naviItem.width)
          && o.yCoord >= naviItem.y && o.yCoord <= (naviItem.y + naviItem.height)
        ) {
          isInGrid = true
          gridLabels.push(naviItem.label)
        }
        return isInGrid
      })
    })
    // the code below sometimes one item can be into several grids
    // _.forEach(mainstore.navigationGrids, (naviItem: GridCell, index) => {
    //   let flag = _.findIndex(targetDataItems, function (o) {
    //     let isInGrid = false
    //     if (o.xCoord >= naviItem.x && o.xCoord <= (naviItem.x + naviItem.width)
    //       && o.yCoord >= naviItem.y && o.yCoord <= (naviItem.y + naviItem.height)
    //     ) isInGrid = true
    //     return isInGrid
    //   })

    //   if (flag > -1) gridLabels.push(naviItem.label)
    // })
  } else {
    console.log("No unitNow or unitLast.");
  }
  return _.uniq(gridLabels)
}

// this function is very similar to selectGrid
export function zoomIntoGrids({ labels, margin, mainstore }: {
  labels: string[];
  margin: number; // zoom margin
  mainstore: MainStore;
}) {
  const unitNow = mainstore.unitNow

  if (unitNow) {
    // check if grids have been drawn cause highlight is needed in function zoomIntoGrids
    const svg = d3.select("#chart-overlay");
    let duration = 0
    if (svg.selectAll(".grid-cell").empty()) {// no grids be drawn
      createGrids4Navigation({ mainstore })
      duration = 1
    }

    // a. highlight selected grids: gridCells are fixed for zoom task, which is stored in main
    // FIXME: sometimes grids are not nearby, highlighting needs fixing
    const gridCells = mainstore.navigationGrids

    setTimeout(() => {
      highlightGridCell({ labels, gridCells })
    }, duration * 1000)

    setTimeout(() => {
      switchSVGOverlay(false) // hide grids

      // b. filter data by grids
      const cells: GridCell[] = _.filter(gridCells, d => _.includes(labels, d.label));
      console.log("cells", JSON.parse(JSON.stringify(cells)));

      if (unitNow && cells && cells.length > 0) {
        // find the left and right border for x
        // find the top and bottom border for y
        let cell = { x1: cells[0].x, x2: cells[0].x + cells[0].width, y1: cells[0].y, y2: cells[0].y + cells[0].height }
        _.forEach(cells, o => {
          if (o.x < cell.x1) cell.x1 = o.x
          if ((o.x + o.width) > cell.x2) cell.x2 = o.x + o.width
          if (o.y < cell.y1) cell.y1 = o.y
          if ((o.y + o.height) > cell.y2) cell.y2 = o.y + o.height
        });
        // add margins to borders
        let xDomain = [mainstore.xyScales.xInvert(cell.x1 * (1 - margin)), mainstore.xyScales.xInvert(cell.x2 * (1 + margin))]
        let yDomain = [mainstore.xyScales.yInvert(cell.y2 * (1 + margin)), mainstore.xyScales.yInvert(cell.y1 * (1 - margin))]
        xDomain = [_.round(xDomain[0], 2), _.round(xDomain[1], 2)]
        yDomain = [_.round(yDomain[0], 2), _.round(yDomain[1], 2)]
        console.log("domains", xDomain, yDomain);

        // adjust the spec
        filterData(unitNow.chartSpec, xDomain, yDomain)
        adjustScale(unitNow.chartSpec, xDomain, yDomain)

        // c. re-render
        mainstore.update_flag = !mainstore.update_flag
      } else {
        console.log("interactUnitNow is null or no matching grid cells.");
      }
    }, (duration + 1) * 1000);
  } else {
    console.log("No unitNow or unitLast.");
  }
}

function undoLastZoomIn({ mainstore }: { mainstore: MainStore }) {
  // console.log("mainstore", toJS(mainstore));
  const unitNow = mainstore.unitNow

  // 1. locate the unit before the last zoom
  const lastUnitIndex = _.findLastIndex(mainstore.interactions, function (unit: InteractUnit) {
    return unit.task == 'zoom'
      && unit.isZoomClear == false
      && (unit.status == InteractStatus.End || unit.status == InteractStatus.Direct);
  })
  const lastUnit = mainstore.interactions.at(lastUnitIndex)
  console.log("lastUnitIndex", lastUnitIndex);

  // works for one step and multi-step
  let actionFlag = true
  if (unitNow && lastUnit && lastUnitIndex > -1) {
    let unitBeforeSpec: any

    // get the spec before the filter
    if (lastUnitIndex == 0) {// deal with if zoom in is the first interact
      unitBeforeSpec = mainstore.specification_org
    } else {// if there is a unit before the zoom unit
      unitBeforeSpec = mainstore.interactions.at(lastUnitIndex - 1)?.chartSpec
    }

    if (unitBeforeSpec) {
      // 2. adjust the current spec based on the old spec
      // 2.1 adjust data
      // unitNow.chartSpec = unitBefore?.chartSpec
      unitNow.chartSpec.data.values = unitBeforeSpec.data.values

      // 2.2 adjust the scale: only if scale exists
      if (unitBeforeSpec.encoding.x.scale) {
        unitNow.chartSpec.encoding.x.scale['domain'] = unitBeforeSpec.encoding.x.scale.domain
      } else {
        delete unitNow.chartSpec.encoding.x.scale.domain
      }
      if (unitBeforeSpec.encoding.y.scale) {
        unitNow.chartSpec.encoding.y.scale['domain'] = unitBeforeSpec.encoding.y.scale.domain
      } else {
        delete unitNow.chartSpec.encoding.y.scale.domain
      }

      // 3. update unit: set isfilterclear =  true
      lastUnit.isZoomClear = true

      // re-render
      mainstore.update_flag = !mainstore.update_flag
    } else {
      console.log("Can't find last spec to refer to.");
    }
  } else {
    actionFlag = false
  }

  if (actionFlag == false) {// no zoom to act
    // inform the user
    const responseText = `"No zoom to undo. Please try other commands.`
    createTextResponseBySystem({ responseText, mainstore })

    console.log("No zoom to undo.");
  }

  // console.log("mainstore", toJS(mainstore));
}


// ----------- pan task -----------
// this function is very similar to zoomIntoGrids
export function panIntoGrids({ labels, margin, mainstore }: {
  labels: string[];
  margin: number; // pan margin
  mainstore: MainStore;
}) {
  const unitNow = mainstore.unitNow

  // locate last unit spec who is not pan
  const lastOtherUnit: InteractUnit = _.findLast(mainstore.interactions, function (o: InteractUnit) {
    return o.task != 'pan'
  })
  let lastOtherUnitSpec: any = ""
  if (lastOtherUnit) {// handle if pan is the first act or no other unit exist before pan
    lastOtherUnitSpec = lastOtherUnit.chartSpec
  } else {
    lastOtherUnitSpec = mainstore.specification_org
  }

  // only navi to the first label -> get the center of selected cells, and decide where to move
  // labels = [labels[0]]
  if (unitNow && lastOtherUnitSpec != "") {
    // check if grids have been drawn cause highlight is needed in function zoomIntoGrids
    const svg = d3.select("#chart-overlay");
    let duration = 0
    if (svg.selectAll(".grid-cell").empty()) {// no grids be drawn
      createGrids4Navigation({ mainstore })
      duration = 1
    }

    // a. highlight selected grids: gridCells are fixed for zoom task, which is stored in main
    // FIXME: sometimes grids are not nearby, highlighting needs fixing
    const gridCells = mainstore.navigationGrids

    setTimeout(() => {
      highlightGridCell({ labels, gridCells })
    }, duration * 1000)

    setTimeout(() => {
      switchSVGOverlay(false) // hide grids

      // locate selected grids by labels
      const cells: GridCell[] = _.filter(gridCells, d => _.includes(labels, d.label));
      console.log("pan into cells", JSON.parse(JSON.stringify(cells)));

      if (cells && cells.length > 0) {
        // find the left (x1) and right (x2) border for x
        // find the top (y1) and bottom (y2) border for y
        let cell = { x1: cells[0].x, x2: cells[0].x + cells[0].width, y1: cells[0].y, y2: cells[0].y + cells[0].height }
        _.forEach(cells, o => {
          if (o.x < cell.x1) cell.x1 = o.x
          if ((o.x + o.width) > cell.x2) cell.x2 = o.x + o.width
          if (o.y < cell.y1) cell.y1 = o.y
          if ((o.y + o.height) > cell.y2) cell.y2 = o.y + o.height
        });

        // get the center of selected grids
        const panCenter = {
          x: 1 / 2 * (cell.x1 + cell.x2),
          y: 1 / 2 * (cell.y1 + cell.y2)
        }
        console.log("navi center is ", panCenter);

        // FIXME: get the new domain
        let newXYDomains = getNewDomainForPan({ panCenter, mainstore })
        let xDomain = newXYDomains.xDomain
        let yDomain = newXYDomains.yDomain
        console.log("domains", toJS(xDomain), toJS(yDomain));

        // FIXME: adjust the spec based on current spec
        adjustScale(unitNow.chartSpec, xDomain, yDomain)

        // FIXME: adjust data based on the unit before the pans 
        // look from the last to find the first other unit
        filterData4Pan(unitNow.chartSpec, lastOtherUnitSpec, xDomain, yDomain)

        // c. re-render
        mainstore.update_flag = !mainstore.update_flag
      } else {
        console.log("No matching grid cells.");
      }
    }, (duration + 1) * 1000);
  } else {
    console.log("No unitNow or lastOtherUnitSpec.");
  }
}

// this function is very similar to undoLastZoomIn (modified based on)
function undoLastPanIn({ mainstore }: { mainstore: MainStore }) {
  // console.log("mainstore", toJS(mainstore));
  const unitNow = mainstore.unitNow

  // 1. locate the unit before the last zoom
  const lastUnitIndex = _.findLastIndex(mainstore.interactions, function (unit: InteractUnit) {
    return unit.task == 'pan'
      && unit.isPanClear == false
      && (unit.status == InteractStatus.End || unit.status == InteractStatus.Direct);
  })
  const lastUnit = mainstore.interactions.at(lastUnitIndex)
  console.log("lastUnitIndex", lastUnitIndex);

  // works for one step and multi-step
  let actionFlag = true
  if (unitNow && lastUnit && lastUnitIndex > -1) {
    let unitBeforeSpec: any

    // get the spec before the filter
    if (lastUnitIndex == 0) {// deal with if zoom in is the first interact
      unitBeforeSpec = mainstore.specification_org
    } else {// if there is a unit before the zoom unit
      unitBeforeSpec = mainstore.interactions.at(lastUnitIndex - 1)?.chartSpec
    }

    if (unitBeforeSpec) {
      // 2. adjust the current spec based on the old spec
      // 2.1 adjust data
      // unitNow.chartSpec = unitBefore?.chartSpec
      unitNow.chartSpec.data.values = unitBeforeSpec.data.values

      // 2.2 adjust the scale: only if scale exists
      if (unitBeforeSpec.encoding.x.scale) {
        unitNow.chartSpec.encoding.x.scale['domain'] = unitBeforeSpec.encoding.x.scale.domain
      } else {
        delete unitNow.chartSpec.encoding.x.scale.domain
      }
      if (unitBeforeSpec.encoding.y.scale) {
        unitNow.chartSpec.encoding.y.scale['domain'] = unitBeforeSpec.encoding.y.scale.domain
      } else {
        delete unitNow.chartSpec.encoding.y.scale.domain
      }

      // 3. update unit: set isfilterclear =  true
      lastUnit.isPanClear = true

      // re-render
      mainstore.update_flag = !mainstore.update_flag
    } else {
      console.log("Can't find last spec to refer to.");
    }
  } else {
    actionFlag = false
  }

  if (actionFlag == false) {// no zoom to act
    // inform the user
    const responseText = `"No pan to undo. Please try other commands.`
    createTextResponseBySystem({ responseText, mainstore })

    console.log("No zoom to undone.");
  }

  // console.log("mainstore", toJS(mainstore));
}

function getNewDomainForPan({ panCenter, mainstore }: {
  panCenter: { x: number, y: number };
  mainstore: MainStore;
}) {
  let xDomain: number[] = mainstore.xyScales.xDomain
  let xDomainLen = mainstore.xyScales.xDomain[1] - mainstore.xyScales.xDomain[0]
  let yDomain: number[] = mainstore.xyScales.yDomain
  let yDomainLen = mainstore.xyScales.yDomain[1] - mainstore.xyScales.yDomain[0]

  // check which grid panCenter is into
  let naviGrid: GridCell = _.find(mainstore.navigationGrids, function (grid: GridCell) {
    let flag = false
    if (panCenter.x >= grid.x && panCenter.x < (grid.x + grid.width)
      && panCenter.y >= grid.y && panCenter.y < (grid.y + grid.height)
    ) {
      flag = true
    }
    return flag
  })

  let panCenterValue = {
    x: mainstore.xyScales.xInvert(panCenter.x),
    y: mainstore.xyScales.yInvert(panCenter.y)
  }
  console.log("panCenterValue", panCenterValue);

  if (naviGrid.label == '1') {
    xDomain = [panCenterValue.x, xDomainLen + panCenterValue.x] // yes
    yDomain = [yDomain[0] - (yDomainLen - panCenterValue.y), yDomain[1] - (yDomainLen - panCenterValue.y)] // yes   
  } else if (naviGrid.label == '2') {
    // xDomain = mainstore.xyScales.xDomain // yes
    yDomain = [yDomain[0] - (yDomainLen - panCenterValue.y), yDomain[1] - (yDomainLen - panCenterValue.y)] // yes
  } else if (naviGrid.label == '3') {
    xDomain = [panCenterValue.x - xDomainLen, panCenterValue.x] // yes
    yDomain = [yDomain[0] - (yDomainLen - panCenterValue.y), yDomain[1] - (yDomainLen - panCenterValue.y)] // yes    
  } else if (naviGrid.label == '4') {
    xDomain = [panCenterValue.x, xDomainLen + panCenterValue.x] // yes
    // yDomain = mainstore.xyScales.yDomain // yes
  } else if (naviGrid.label == '5') {
    // xDomain = mainstore.xyScales.xDomain // yes
    // yDomain = mainstore.xyScales.yDomain // yes
  } else if (naviGrid.label == '6') {
    xDomain = [panCenterValue.x - xDomainLen, panCenterValue.x] // yes
    // yDomain = mainstore.xyScales.yDomain // yes
  } else if (naviGrid.label == '7') {
    xDomain = [panCenterValue.x, xDomainLen + panCenterValue.x] // yes
    yDomain = [panCenterValue.y, yDomainLen + panCenterValue.y] // yes
  } else if (naviGrid.label == '8') {
    // xDomain = mainstore.xyScales.xDomain // yes
    yDomain = [panCenterValue.y, yDomainLen + panCenterValue.y] // yes
  } else if (naviGrid.label == '9') {
    xDomain = [panCenterValue.x - xDomainLen, panCenterValue.x] // yes
    yDomain = [panCenterValue.y, yDomainLen + panCenterValue.y] // yes
  }

  return { xDomain: xDomain, yDomain: yDomain }
}

export function filterData4Pan(spec, specBeforePan, xDomain, yDomain) {
  let filteredData = specBeforePan.data.values.filter(d =>
    d.x >= xDomain[0] && d.x <= xDomain[1] &&
    d.y >= yDomain[0] && d.y <= yDomain[1]
  );
  console.log("filterData", JSON.parse(JSON.stringify(filteredData)));

  spec.data.values = filteredData
}


// ----------- aggregate task -----------
export type AggregationType = {
  channel: string;
  attribute: string;
  operation: string;
};

export type EncodingType = {
  channel: string;
  label: string; // used for aggregate
  field: string;
  type: string;
};

function updateSpec2Aggregate({ labels, mainstore }: {
  labels: string[];
  mainstore: MainStore;
}) {
  const unitNow = mainstore.unitNow
  const attributeAgg = mainstore.aggregationIndicator.attribute
  const operationAgg = mainstore.aggregationIndicator.operation

  if (unitNow) {
    const chartSpec = unitNow.chartSpec
    if (chartSpec) {
      // highlight aggregated channel
      // the code below is the same as highlightAggregateAttribute
      // repeat because of duration
      // -----------------------start----------------------
      console.log("mainstore.aggregateEncoding", toJS(mainstore.aggregateEncoding));
      if (labels.length == 0) {// map attr to grid label for highlighting
        _.forEach(mainstore.aggregateEncoding, function (o: EncodingType) {
          console.log("o", o, o.field, o.field.toUpperCase());

          if (o.field && (o.field.toLowerCase() == attributeAgg.toLowerCase())) {
            labels.push(o.label)

            return false // break for each
          }
        })
      }

      // check if grids have been drawn cause highlight is needed in function zoomIntoGrids
      const svg = d3.select("#chart-overlay");
      let duration = 0
      if (svg.selectAll(".grid-cell").empty()) {// no grids be drawn
        guide2SelectAggregationAttibute({ mainstore })
        duration = 1
      }

      // gridCells are fixed for aggregate task, which is stored in main
      const gridCells = mainstore.aggregationGrids
      setTimeout(() => {
        highlightGridCell({ labels, gridCells })
      }, duration * 1000)
      // ----------------------end-----------------------

      setTimeout(() => {
        switchSVGOverlay(false) // hide grids

        // update spec to include aggregate
        let flag = false
        _.forEach(chartSpec.encoding, function (o, key) {
          // console.log(`encoding ${key}: `, toJS(o));
          if (o['field'] && o['field'].toLowerCase() == attributeAgg.toLowerCase()) {
            flag = true
            chartSpec.encoding[key]['aggregate'] = operationAgg.toLowerCase()
            // update title to make sure aggregation shown in title (only need to deal with when title exist, if not exist, vega-lite will add the info automatically)
            if (o['axis'] && o['axis'].title) {
              // this one also works
              // o['axis'].title = _.capitalize(operationAgg) + " of " + o['axis']['title']
              // chartSpec.encoding[key].axis.title = _.capitalize(operationAgg) + " of " + o['axis']['title']
              // delete title directly to make sure title is automatically generated [or I will have to deal with title when undo aggregate]
              delete chartSpec.encoding[key].axis.title
            }

            // update the unit: aggregationIndicator
            mainstore.aggregationIndicator.channel = key
            unitNow.aggregationIndicator = _.cloneDeep(mainstore.aggregationIndicator)
            console.log("after aggregation unitNow: ", toJS(unitNow));

            // update store
            // reset aggregationIndicator
            mainstore.aggregationIndicator = { attribute: "", operation: "", channel: "" }
            // re-render
            mainstore.update_flag = !mainstore.update_flag

            // break the loop if the channel to aggregate is done
            return false
          }
        })

        if (flag == false) {
          mainstore.isCommandSupported = false
        }
      }, (duration + 1) * 1000)
    } else {
      console.log("unitNow's chartSpec is null.");
    }
  } else {
    console.log("unitNow is null.");
  }
}

function guide2SelectAggregationAttibute({ mainstore }: {
  mainstore: MainStore;
}) {
  // get the aggregation attributes
  // let attrs2Agg: EncodingType[] = []
  // _.forEach(mainstore.chartEncodedAttributes, function (o, key) {
  //   if (o.type == "quantitative") attrs2Agg.push(o)
  // })

  // 1. FIXME: only show grids for quantitative data on chart
  createThenShowGridsAndLabels4Aggregate(mainstore)

  // 2. inform the user attributes in chat
  if (mainstore.aggregationIndicator.attribute == "") {
    // const responseText = `"Please choose the attribute to aggregate, e.g., ${_.map(mainstore.aggregateEncoding, "field").join(", ")}.`

    // gudie users to use label directly
    const responseText = `"Please choose the attribute to aggregate, e.g., 1 for xAxis, 2 for yAxis}.`
    createTextResponseBySystem({ responseText, mainstore })
  }
}

function highlightAggregateAttribute({ labels, mainstore }: {
  labels: string[];
  mainstore: MainStore;
}) {
  const attributeAgg = mainstore.aggregationIndicator.attribute

  if (labels.length == 0) {// map attr to grid label for highlighting
    _.forEach(mainstore.aggregateEncoding, function (o: EncodingType) {
      if (o['field'] && o['field'].toLowerCase() == attributeAgg.toLowerCase()) {
        labels.push(o.label)

        return false // break for each
      }
    })
  }

  // check if grids have been drawn cause highlight is needed in function zoomIntoGrids
  const svg = d3.select("#chart-overlay");
  let duration = 0
  if (svg.selectAll(".grid-cell").empty()) {// no grids be drawn
    guide2SelectAggregationAttibute({ mainstore })
    duration = 1
  }

  // gridCells are fixed for aggregate task, which is stored in main
  const gridCells = mainstore.aggregationGrids
  setTimeout(() => {
    highlightGridCell({ labels, gridCells })
  }, duration * 1000)
}


// this function is very similar to createThenShowGridsAndLabels
export function createThenShowGridsAndLabels4Aggregate(mainstore: MainStore) {
  const unitNow = mainstore.unitNow

  if (unitNow) {
    // newly added
    // filter no quantitative attrs
    let grids2Show: string[] = []
    _.forEach(mainstore.aggregateEncoding, function (o: EncodingType) {
      grids2Show.push(o.label)
    })
    // Generate customized grid cells
    const gridCells: GridCell[] = _.filter(mainstore.aggregationGrids, function (o: GridCell) {
      return _.includes(grids2Show, o.label)
    })

    // Set up the SVG
    const svg = d3.select("#chart-overlay");

    // Grid configuration
    const xyCoords: XYCoords = { xCoords: [], yCoords: [] } // newly added
    const gridOptions = {
      svg: svg,
      xyCoords: xyCoords,
      gridCells: gridCells,
      color: "gray",
      strokeWidth: 1,
      showLabels: true, // Enable labels
      labelStyle: { fontSize: 13, color: "blue", dx: 0, dy: 0 }
    };

    // Draw the grid
    drawGridAndLabel(gridOptions);

    // store the data
    unitNow.labelType = LabelType.GridItem
    unitNow.overlayCoords = xyCoords
    unitNow.overlayGrids = gridCells
  } else {
    console.log("unitNow is null.");
  }
}

// this function is very similar to undoLastZoomIn (modified based on)
function undoLastAggregate({ mainstore }: { mainstore: MainStore }) {
  // console.log("mainstore", toJS(mainstore));
  const unitNow = mainstore.unitNow

  // 1. locate the unit before the last zoom
  const lastUnitIndex = _.findLastIndex(mainstore.interactions, function (unit: InteractUnit) {
    return unit.task == 'aggregate'
      && unit.isAggregateClear == false
      && (unit.status == InteractStatus.End || unit.status == InteractStatus.Direct);
  })
  const lastUnit = mainstore.interactions.at(lastUnitIndex)
  console.log("lastUnitIndex", lastUnitIndex);

  // works for one step and multi-step
  let actionFlag = true
  if (unitNow && lastUnit && lastUnitIndex > -1) {
    // 2. adjust the current spec based on last aggregate unit
    // delete aggregation in unitNow following lastUnit 
    if (lastUnit.aggregationIndicator && lastUnit.aggregationIndicator.channel != "") {
      delete unitNow.chartSpec.encoding[lastUnit.aggregationIndicator?.channel].aggregate

      // 3. update unit: set isfilterclear =  true
      lastUnit.isAggregateClear = true

      // re-render
      mainstore.update_flag = !mainstore.update_flag
    } else {
      actionFlag = false
    }
  } else {
    actionFlag = false
  }

  if (actionFlag == false) {// no zoom to act
    // inform the user
    const responseText = `"No aggregate to undo. Please try other commands.`
    createTextResponseBySystem({ responseText, mainstore })

    console.log("No aggregate to undo.");
  }

  // console.log("mainstore", toJS(mainstore));
}


// ----------- change color task -----------
function changeTask_AdjustColor({ color, mainstore }: {
  color: string;
  mainstore: MainStore;
}) {
  const unitNow = mainstore.unitNow

  let actionFlag = true
  if (unitNow) {
    // change spec to have color info
    if (mainstore.colorChannel.hasChannel && mainstore.colorChannel.field != "") {// has color channel
      if (unitNow.chartSpec.encoding['color']['scale']) {
        unitNow.chartSpec.encoding['color']['scale']['scheme'] = color
      } else {
        unitNow.chartSpec.encoding['color']['scale'] = { scheme: color }
      }
    } else {// no color channel
      unitNow.chartSpec.encoding['color'] = { value: color }
    }

    // clear change color type
    mainstore.changeColorIndicator.isOneStep = true

    // re-render
    mainstore.update_flag = !mainstore.update_flag
  } else {
    actionFlag = false
  }

  if (actionFlag == false) {// fail to change color
    // inform the user
    const responseText = `"Fail to change color. Please re-try.`
    createTextResponseBySystem({ responseText, mainstore })

    console.log("fail to change color.");
  }
}


// -------------------------SpeechViz------------------------
export enum APIState {
  Default = 'Default', // default status
  Sending = 'Sending', // calling llm now
  Success = 'Success', // call function to act
  Fail = 'Fail', // inform user to re-try
  Blank = 'Blank',
}

export enum ChartType {
  Scatter = 'Scatter',
  Bar = 'Bar',
  GroupBar = 'GroupBar',
  Line = 'Line',
  Pie = 'Pie',
  Other = 'Other',
}

// define types
export type InteractUnit = {
  // adapt to SpeechViz
  speech: Message;
  feedbackSpeech?: Message;

  index?: number; // index for an interaction
  type?: string; // types of tasks recognized from speech
  task?: string; // task recognized from speech
  subType?: string; // sub task type recognized from speech

  status?: InteractStatus; // use status to show progress, start + ongoing + end, or start + end, or direct; plus task to distinguish
  isEffective?: boolean; // document the status of the task, effective or invalid
  selectedDataItem?: string[]; // store the ids of the data items

  chartSpec?: any;
  modifyType?: SpecModifyType; // document 
  newData?: any;
  newDomain?: { xDomain: any; yDomain: any; } // works for types of charts

  ambiguity?: AmbiguityType[] | string[]; // ducoment if the command is ambiguous
  isAidOn?: boolean | AidState; // show aids or not, the former is to simplify the implement logic (cause types of label can be found in labelType), the latter is to ducument the status of each aid
  labelType?: LabelType[] | LabelType;
  overlayGrids?: GridCell[];
  gridsToDataItems?: Grid2DataItems[] // map grid label to data items
  selectedLabel?: string[];

  startTime?: number; // time when start executing the unit
  endTime?: number;


  // (maybe deprecated) used for speech to inteact
  subIndex?: number; // index for steps of an interaction
  // steps?: number; // number for the steps, used to show progress

  overlayCoords?: XYCoords;
  feedbackVisual?: any;

  // used for select task
  isSelected?: boolean; // document if selection is removed, if removed, set to false
  // selectedDataItem?: string[]; // store the ids of the data items

  // used for filter task
  isFilterClear?: boolean; // document if filter is undo, if undo, set true
  filteredDataItems?: string[]; // store the ids of the data items

  // used for zoom task
  isZoomClear?: boolean; // document if zoom is undo, if undo, set true

  // used for pan task
  isPanClear?: boolean; // document if pan is undo, if undo, set true

  // used for aggregate task
  isAggregateClear?: boolean; // document if pan is undo, if undo, set true
  aggregationIndicator?: AggregationType; // store aggregation indicators for undo
}

export enum InteractTask {
  Select = 'select',
  InclusiveFilter = 'inclusive filter',
  ExclusiveFilter = 'exclusive filter',
  Highlight = 'highlight',
  ShowDetails = 'show details',
  Zoom = 'zoom',
  Pan = 'pan',
  Aggregate = 'aggregate',
  Sort = 'sort',
  ShowGrids = 'show grids',
  ShowLabels = 'show labels',
  Undo = 'undo',
  Redo = 'redo',
  Reset = 'reset',
  ClearSelect = 'clear select',
  ClearFilter = 'clear filter',
  HideDetails = 'hide details',
  Unhighlight = 'unhighlight',
  ZoomOut = 'zoom out',
  PanOut = 'pan out',
  RemoveAggregation = 'remove aggregation',
  RemoveSort = 'remove sort',
  HideGrids = 'hide grids',
  HideLabels = 'hide labels',
}

export enum InteractStatus {
  SpeechOn = 'SpeechOn',
  SpeechOff = 'SpeechOff',
  // status when iteracting
  // Iterative = 'Iterative',
  Start = 'Start',
  Ongoing = 'Ongoing',
  End = 'End',
  Direct = 'Direct'
}

export enum AmbiguityType {
  Position = 'Position',
  Color = 'Color',
  Shape = 'Shape',
  DataValue = 'DataValue',
  Other = 'Other',
  None = 'None'
}

export enum AmbiguityDetailType {
  // used for position
  Top = 'Top',
  Right = 'Right',
  Bottom = 'Bottom',
  Left = 'Left',
  Center = 'Center',
  TopRight = 'Top Right',
  TopLeft = 'Top Left',
  BottomLeft = 'Bottom Left',
  BottomRight = 'Bottom Right',

  // used for value
  XBigger = 'XBigger',
  XSmaller = 'XSmaller',
  XMiddle = 'XMiddle',
  YBigger = 'YBigger',
  YSmaller = 'YSmaller',
  YMiddle = 'YMiddle',
}

export enum SpecModifyType {
  Data = 'Data',
  Domain = 'Domain',
  Other = 'Other',
}

export type AidState = {
  grid?: boolean;
  markLabel?: boolean;
  legendLabel?: boolean;
};

export enum LabelType {
  GridItem = 'GridItem',

  DataItem = 'DataItem', // including mark label, legend label
  MarkItem = 'MarkItem',
  LegendItem = 'LegendItem'
}

export type Grid2DataItems = {
  label: string;
  ids: string[]
};

export type Message = {
  sender: SenderType;
  text: string;
};

export enum SenderType {
  User = 'User',
  System = 'System'
}

// NL to interaction tasks: LLM-powered (SpeechViz, smarter interaction)
// map and distill
export async function handleSpeechCommandSV({ transcript, mainstore }: { transcript: string, mainstore: MainStore }) {
  const unitNow = mainstore.unitNow
  const unitLast = mainstore.interactions.at(-2)

  if (unitNow) {
    // document the start time
    unitNow.startTime = Date.now()

    // reset for new commands: api state, isCommandSupporte
    mainstore.apiState = APIState.Default
    mainstore.isCommandSupported = true

    // update aid state
    // if (mainstore.ambiguityFlag.hasAmbiguity) {
    //   clearTimeout(mainstore.ambiguityFlag.hideAidTimerID)
    // }
    // enable interact with grids when it's on
    if (mainstore.ambiguityFlag.hideAidTimerID) {
      clearTimeout(mainstore.ambiguityFlag.hideAidTimerID)
    }

    // to call llm 
    mainstore.apiState = APIState.Sending // update api state
    // FIXME: open when calling LLM
    // build context
    let context = ""
    if (unitLast && unitLast.isAidOn == true) {
      let mapping
      // add context based on label type
      if (unitLast.labelType == LabelType.GridItem) {
        mapping = unitLast.gridsToDataItems
      } else if (unitLast.labelType == LabelType.DataItem) {
        let mapping1 = unitLast.chartSpec.data.values.map(o => ({// mark labels
          label: o.label,
          ids: [o.id]
        }));

        let mapping2 = mainstore.legendMapping.map(o => ({// legend labels
          label: o.label,
          ids: o.ids
        }))

        mapping = _.concat(mapping1, mapping2)
      } else if (unitLast.labelType == LabelType.MarkItem) {
        mapping = unitLast.chartSpec.data.values.map(o => ({
          label: o.label,
          ids: [o.id]
        }));
      } else {// legend label
        mapping = mainstore.legendMapping.map(o => ({
          label: o.label,
          ids: o.ids
        }))
      }

      context = `
        "Last command":
        ${unitLast.speech.text}

        "Mapping between number labels and data items (using their id)":
        ${_.join(_.map(mapping, (o) => JSON.stringify(o)), "\n ")}
        `
      // also enhance transcript to provide the context for labels
      // transcript = transcript + "(number refer to label)"
    }

    const result = await mapAndDistillSpeech2TaskSV(
      transcript,
      context,
      mainstore.attr2Encoding,
      // mainstore.dataItemsOrg,
      _.map(mainstore.dataItemsOrg, o => _.omit(o, ['label'])), // omit irrelevant data attrs
      mainstore.selectedItems,
      mainstore.chartType,
      { "xDomain": mainstore.xyScales.xDomain, "yDomain": mainstore.xyScales.yDomain },
      mainstore.domainsOrg,
    );

    // testing for select
    // let result
    // mainstore.selectedItems = ['id1', 'id2', 'id3', 'id4']
    // result = {
    //   "type": "T1",
    //   "task": "inclusive filter",
    //   "ids": [
    //     "id7",
    //     "id8",
    //     "id9",
    //     "id16"
    //   ],
    //   "ambiguity": [],
    //   "ambiguityDetail": [],
    //   "response": "The data items with x values greater than 6 have been filtered."
    // }

    // result = {
    //   "type": "T1",
    //   "task": "select",
    //   "ids": [],
    //   "ambiguity": [
    //     "Position"
    //   ],
    //   "ambiguityDetail": [
    //     "Top"
    //   ],
    //   "response": "Could you please clarify which specific data items you would like to select from the top? For example, you could specify a value or a category."
    // }

    if (result && result.type && atomicActionsSV[result.type]) {
      // update api state
      mainstore.apiState = APIState.Success

      // clear ambiguity for new commands
      // mainstore.ambiguityFlag.hasAmbiguity = false

      // Call the function with parameters
      atomicActionsSV[result.type]({ transcript: transcript, responseLLM: result, mainstore: mainstore });

      // clear redo for new task: check the task, if not redo (pop out from list) or undo (set into list), clear redo
      if (mainstore.redoList.length > 0 && result.task != 'undo' && result.task != 'redo') {
        mainstore.redoList = []
      }

      // set reset indiactor for new task
      if (result.task != 'reset') {
        mainstore.resetIndicator.isReset = false
      }

    } else {
      console.log("Command not recognized or no matching function.");
      console.log("llm result: ", result);
      mainstore.apiState = APIState.Fail
      mainstore.isCommandSupported = false
    }

    // document the end time
    unitNow.endTime = Date.now()
    console.log(`Duration: ${((unitNow.endTime - unitNow.startTime) / 1000).toFixed(0)} s`);
  } else {
    mainstore.isCommandSupported = false
    console.log("unitNow is null.");
  }

  if (mainstore.isCommandSupported == false) {
    const responseText = `"Sorrry! ${transcript}" is not working. Please try other commands.`
    createTextResponseBySystem({ responseText, mainstore })
  }

  // console.log("unitNow", toJS(mainstore.unitNow));
  // console.log("interactions", toJS(mainstore.interactions));
}

const atomicActionsSV = {
  temp: ({ transcript, responseLLM, mainstore }: { transcript: string; responseLLM: any, mainstore: MainStore }) => {
    console.log(`temp ...`)
    const typeAct = responseLLM.type
    const task = responseLLM.task
    const responseText = responseLLM.response

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: index, type, task
      unitNow.index = countTemp
      unitNow.type = typeAct
      unitNow.task = task
      unitNow.status = InteractStatus.End
      // end of task
      mainstore.count += 1
      // update unit: feedbackSpeech 
      createTextResponseBySystem({ responseText, mainstore })
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
  // handle ambiguity with grids
  T1V_1: ({ transcript, responseLLM, mainstore }: { transcript: string; responseLLM: any, mainstore: MainStore }) => {
    console.log(`T1-ing`)

    // unpack LLM response
    const typeAct = responseLLM.type
    const task = responseLLM.task
    // const subType = responseLLM.subType
    const selectedIds = responseLLM.ids
    let ambiguity = responseLLM.ambiguity
    let ambiguityDetail: string = responseLLM.ambiguityDetail
    const responseText = responseLLM.response
    const distilledLabels = responseLLM.label // labels distilled from the command

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: index, type, task
      unitNow.index = countTemp
      unitNow.type = typeAct
      unitNow.task = task
      // update unit: selectedDataItem
      unitNow.selectedDataItem = selectedIds
      // update unit: feedbackSpeech 
      createTextResponseBySystem({ responseText, mainstore })

      // test label drawing
      // const labelItems = distillLabelCoordByIdsSV({
      //   ids: ['id1', 'id2', 'id3', 'id4', 'id5'],
      //   mainstore: mainstore
      // })
      // drawLabelsSV({
      //   chartType: mainstore.chartType,
      //   labelItems: labelItems,
      //   highlightList: ['id2', 'id4'],
      // })
      // console.log("unitNow", toJS(unitNow));

      // deal with ambiguity
      if (ambiguity.length > 0) {// has ambiguity
        // only deal with the first ambiguity
        ambiguity = ambiguity[0]
        ambiguityDetail = ambiguityDetail[0]

        // update unit
        unitNow.status = InteractStatus.Ongoing
        unitNow.ambiguity = ambiguity
        unitNow.isAidOn = true

        // update ambiguity status to store
        if (mainstore.ambiguityFlag.hideAidTimerID) {
          clearTimeout(mainstore.ambiguityFlag.hideAidTimerID)
        }
        mainstore.ambiguityFlag.hasAmbiguity = true
        mainstore.ambiguityFlag.hideAidTimerID = undefined

        if (ambiguity == AmbiguityType.Color || ambiguity == AmbiguityType.Shape) {
          console.log("ambiguity: ", ambiguity);

          // only inform users to select from available colors or shapes
          // not use label, cause label is not obvious not intuitive

          // // update unit
          // unitNow.labelType = LabelType.LegendItem

          // // show labels near legend
          // const labelItems = distillLabelCoordByIdsSV({
          //   ids: _.map(mainstore.legendMapping, 'id'), // extract all ids from json list
          //   mainstore: mainstore
          // })
          // drawLabelsSV({
          //   chartType: mainstore.chartType,
          //   labelItems: labelItems,
          //   highlightList: [
          //     _.find(mainstore.legendMapping, (o: LegendMapping) => o.colorOrg == ambiguityDetail || o.colorSimple == ambiguityDetail)?.id
          //   ],
          // })
          // console.log("unitNow", toJS(unitNow));
        } else if (ambiguity == AmbiguityType.Position || ambiguity == AmbiguityType.DataValue) {
          console.log("ambiguity: ", ambiguity);
          // update unit
          unitNow.labelType = LabelType.GridItem

          // act based on ambiguity detail type
          // ChartExpanding
          // generate grids data based on ambiguity details
          let ambHighlightList: string[] = []
          if (ambiguityDetail == AmbiguityDetailType.Top || ambiguityDetail == AmbiguityDetailType.YBigger) {
            createGridsSV({
              gridType: GridType.Y,
              xDomain: [0, mainstore.xyScales.xDomain[1]],
              yDomain: [mainstore.statisticForQs['y'].median, mainstore.xyScales.yDomain[1]],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = [unitNow.overlayGrids?.at(0)?.label || '1']
          } else if (ambiguityDetail == AmbiguityDetailType.Bottom || ambiguityDetail == AmbiguityDetailType.YSmaller) {
            createGridsSV({
              gridType: GridType.Y,
              xDomain: [0, mainstore.xyScales.xDomain[1]],
              yDomain: [mainstore.xyScales.yDomain[0], mainstore.statisticForQs['y'].median],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = [unitNow.overlayGrids?.at(-1)?.label || '4']
          } else if (ambiguityDetail == AmbiguityDetailType.Left || ambiguityDetail == AmbiguityDetailType.XSmaller) {
            createGridsSV({
              gridType: GridType.X,
              xDomain: [0, mainstore.statisticForQs['x'].median],
              yDomain: [mainstore.xyScales.yDomain[0], mainstore.xyScales.yDomain[1]],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = [unitNow.overlayGrids?.at(0)?.label || '1']
          } else if (ambiguityDetail == AmbiguityDetailType.Right || ambiguityDetail == AmbiguityDetailType.XBigger) {
            createGridsSV({
              gridType: GridType.X,
              xDomain: [mainstore.statisticForQs['x'].median, mainstore.xyScales.xDomain[1]],
              yDomain: [mainstore.xyScales.yDomain[0], mainstore.xyScales.yDomain[1]],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = [unitNow.overlayGrids?.at(-1)?.label || '4']
          } else if (ambiguityDetail == AmbiguityDetailType.TopLeft) {
            createGridsSV({
              gridType: GridType.XY,
              xDomain: [mainstore.xyScales.xDomain[0], mainstore.statisticForQs['x'].median],
              yDomain: [mainstore.statisticForQs['y'].median, mainstore.xyScales.yDomain[1]],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = [unitNow.overlayGrids?.at(0)?.label || '1']
          } else if (ambiguityDetail == AmbiguityDetailType.TopRight) {
            createGridsSV({
              gridType: GridType.XY,
              xDomain: [mainstore.statisticForQs['x'].median, mainstore.xyScales.xDomain[1]],
              yDomain: [mainstore.statisticForQs['y'].median, mainstore.xyScales.yDomain[1]],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = [unitNow.overlayGrids?.at(1)?.label || '2']
          } else if (ambiguityDetail == AmbiguityDetailType.BottomLeft) {
            createGridsSV({
              gridType: GridType.XY,
              xDomain: [mainstore.xyScales.xDomain[0], mainstore.statisticForQs['x'].median],
              yDomain: [mainstore.xyScales.yDomain[0], mainstore.statisticForQs['y'].median],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = [unitNow.overlayGrids?.at(2)?.label || '3']
          } else if (ambiguityDetail == AmbiguityDetailType.BottomRight) {
            createGridsSV({
              gridType: GridType.XY,
              xDomain: [mainstore.statisticForQs['x'].median, mainstore.xyScales.xDomain[1]],
              yDomain: [mainstore.xyScales.yDomain[0], mainstore.statisticForQs['y'].median],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = [unitNow.overlayGrids?.at(-1)?.label || '4']
          } else if (ambiguityDetail == AmbiguityDetailType.Center) {
            createGridsSV({
              gridType: GridType.XY,
              xDomain: [mainstore.statisticForQs['x'].Q1, mainstore.statisticForQs['x'].Q3],
              yDomain: [mainstore.statisticForQs['y'].Q1, mainstore.statisticForQs['y'].Q3],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = ['1', '2', '3', '4']
          } else if (ambiguityDetail == AmbiguityDetailType.XMiddle) {
            createGridsSV({
              gridType: GridType.X,
              xDomain: [mainstore.statisticForQs['x'].Q1, mainstore.statisticForQs['x'].Q3],
              yDomain: [mainstore.xyScales.yDomain[0], mainstore.xyScales.yDomain[1]],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = [unitNow.overlayGrids?.at(1)?.label || '2',
            unitNow.overlayGrids?.at(2)?.label || '3']
          } else if (ambiguityDetail == AmbiguityDetailType.YMiddle) {
            createGridsSV({
              gridType: GridType.Y,
              xDomain: [mainstore.xyScales.xDomain[0], mainstore.xyScales.xDomain[1]],
              yDomain: [mainstore.statisticForQs['y'].Q1, mainstore.statisticForQs['y'].Q3],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = [unitNow.overlayGrids?.at(1)?.label || '2',
            unitNow.overlayGrids?.at(2)?.label || '3']
          } else {// no matching ambiguity, set the initial grids
            createGridsSV({
              gridType: GridType.XY,
              xDomain: [mainstore.xyScales.xDomain[0], mainstore.xyScales.xDomain[1]],
              yDomain: [mainstore.xyScales.yDomain[0], mainstore.xyScales.yDomain[1]],
              deviate: 5,
              mainstore: mainstore
            })
            // set highlight grid
            ambHighlightList = []
          }

          // set selected items to matching grid
          let selectedItemsAdjusted: string[] = []
          _.forEach(unitNow.gridsToDataItems, (d: Grid2DataItems) => {
            if (_.includes(ambHighlightList, d.label)) {
              selectedItemsAdjusted = _.concat(selectedItemsAdjusted, d.ids)
            }
          })
          unitNow.selectedDataItem = selectedItemsAdjusted

          // hide chart grids (merge to highlight items)
          switchChartGrids(false, mainstore)
          // render: spec change 
          // unitNow.modifyType = SpecModifyType.Other
          // mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender

          // show grids
          drawGridsSV({
            chartType: mainstore.chartType,
            gridCells: unitNow.overlayGrids,
            highlightList: ambHighlightList,
          })
        } else {
          // no actions for this type
          console.log("Other type of ambiguity");
        }

        // hide the aid after some time
        const timeoutId = setTimeout(() => {
          // update unit
          unitNow.isAidOn = false
          unitNow.status = InteractStatus.End
          unitNow.isEffective = true // mark the actual selection by the user
          // end of task
          mainstore.count += 1

          // update ambiguity to store
          mainstore.ambiguityFlag.hasAmbiguity = false

          // hide aids
          const svg = d3.select("#chart-overlay");
          // svg.transition().duration(500).style("opacity", 0);
          svg.transition().duration(500).style("visibility", "hidden");

          // recover chart org grids: only needs for grids drawing
          switchChartGrids(true, mainstore)
          // render: spec change 
          // unitNow.modifyType = SpecModifyType.Other
          // mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender

          // act for task
          actFunctionT1({ mainstore })

          // console.log("unitNow", toJS(unitNow));
          // console.log("mainstore", toJS(mainstore));
        }, mainstore.ambiguityFlag.duration);
        mainstore.ambiguityFlag.hideAidTimerID = timeoutId
      } else {// no ambiguity
        // check last unit to show aid with selected highlight
        if (unitLast
          && unitLast?.isAidOn
          && unitLast.isAidOn == true
          && distilledLabels
          && distilledLabels.length > 0) {
          // update unit
          unitNow.status = InteractStatus.Ongoing

          highlightGridCell({ labels: _.map(distilledLabels, o => o.toString()), gridCells: unitLast?.overlayGrids || [] })

          // hide the aid after some time
          const timeoutId = setTimeout(() => {
            // update unit
            unitNow.isAidOn = false
            unitNow.status = InteractStatus.End
            unitNow.isEffective = true // mark the actual selection by the user
            // end of task
            mainstore.count += 1

            // update ambiguity to store
            mainstore.ambiguityFlag.hasAmbiguity = false

            // hide aids
            const svg = d3.select("#chart-overlay");
            svg.transition().duration(500).style("visibility", "hidden");

            // recover chart org grids: only needs for grids drawing
            switchChartGrids(true, mainstore)
            // render: spec change 
            // unitNow.modifyType = SpecModifyType.Other
            // mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender

            // act for task
            actFunctionT1({ mainstore })

            // console.log("unitNow", toJS(unitNow));
            // console.log("mainstore", toJS(mainstore));
          }, mainstore.ambiguityFlag.duration);
          mainstore.ambiguityFlag.hideAidTimerID = timeoutId
        } else {// no ambiguity and not interact with aids
          // update unit
          unitNow.status = InteractStatus.End
          unitNow.isEffective = true // mark the actual selection by the user
          // end of task
          mainstore.count += 1

          // act for task
          // FIXME: carefully handle timeout
          setTimeout(() => {
            actFunctionT1({ mainstore })
          }, 600);
        }
      }

      // highlight selected using ids
      highlightDataItemsByID({ ids: unitNow.selectedDataItem || [], mainstore: mainstore })
      // render the effect: modify spec
      unitNow.modifyType = SpecModifyType.Other
      mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender

      console.log("unitNow", toJS(unitNow));
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
  // handle ambiguity using message only + merge T1 and T2
  T1V_2: ({ transcript, responseLLM, mainstore }: { transcript: string; responseLLM: any, mainstore: MainStore }) => {
    console.log(`T1-ing`)

    // unpack LLM response
    const typeAct = responseLLM.type
    const task = responseLLM.task
    const selectedIds = responseLLM.ids
    const distilledDomains = responseLLM.domain
    // let ambiguity = responseLLM.ambiguity
    // let ambiguityDetail: string = responseLLM.ambiguityDetail
    const responseText = responseLLM.response
    const distilledLabels = responseLLM.label // labels distilled from the command

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: index, type, task
      unitNow.index = countTemp
      unitNow.type = typeAct
      unitNow.task = task
      // update unit: selectedDataItem
      unitNow.selectedDataItem = selectedIds
      // update unit: feedbackSpeech 
      createTextResponseBySystem({ responseText, mainstore })

      if (typeAct == "T2") {
        // update unit: domain
        unitNow.newDomain = distilledDomains
      }

      if (selectedIds.length > 0 && typeAct == "T1") {// only highlight for T1
        // highlight selected using ids
        highlightDataItemsByID({ ids: unitNow.selectedDataItem || [], mainstore: mainstore })
        // render the effect: modify spec
        unitNow.modifyType = SpecModifyType.Other
        mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
      }

      // check last unit to show aid with selected highlight
      if (unitLast
        && unitLast?.isAidOn
        && unitLast.isAidOn == true
        && distilledLabels
        && distilledLabels.length > 0) {
        // update unit
        unitNow.status = InteractStatus.Ongoing

        highlightGridCell({ labels: _.map(distilledLabels, o => o.toString()), gridCells: unitLast?.overlayGrids || [] })

        // hide the aid after some time
        const timeoutId = setTimeout(() => {
          // update unit
          unitNow.isAidOn = false
          unitNow.status = InteractStatus.End
          unitNow.isEffective = true // mark the actual selection by the user
          // end of task
          mainstore.count += 1

          // hide aids
          const svg = d3.select("#chart-overlay");
          svg.transition().duration(500).style("visibility", "hidden");

          // recover chart org grids: only needs for grids drawing
          switchChartGrids(true, mainstore)
          // render: spec change 
          // unitNow.modifyType = SpecModifyType.Other
          // mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender

          // act for task
          actFunctionT1({ mainstore })

          // console.log("unitNow", toJS(unitNow));
          // console.log("mainstore", toJS(mainstore));
        }, mainstore.ambiguityFlag.duration);
        mainstore.ambiguityFlag.hideAidTimerID = timeoutId
      } else {// no aids in last unit
        // update unit
        unitNow.status = InteractStatus.End
        unitNow.isEffective = true // mark the actual selection by the user
        // end of task
        mainstore.count += 1

        // highlight background of the selection
        createGridsSV({
          gridType: GridType.Whole,
          xDomain: distilledDomains.xDomain,
          yDomain: distilledDomains.yDomain,
          deviate: 5,
          mainstore: mainstore
        })
        drawGridsSV({
          chartType: mainstore.chartType,
          gridCells: unitNow.overlayGrids,
          highlightList: ['1'],
          showGridLabels: false,
        })

        // act for task
        // FIXME: carefully handle timeout
        setTimeout(() => {
          // hide aids
          const svg = d3.select("#chart-overlay");
          svg.transition().duration(500).style("visibility", "hidden");

          // act for task
          actFunctionT1({ mainstore })

          // console.log("unitNow", toJS(unitNow));
          // console.log("mainstore", toJS(mainstore));
        }, mainstore.ambiguityFlag.duration);
      }
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
  T1: ({ transcript, responseLLM, mainstore }: { transcript: string; responseLLM: any, mainstore: MainStore }) => {
    console.log(`T1-ing`)

    // unpack LLM response
    const typeAct = responseLLM.type
    const task = responseLLM.task
    const selectedIds = responseLLM.ids
    // let ambiguity = responseLLM.ambiguity
    // let ambiguityDetail: string = responseLLM.ambiguityDetail
    const responseText = responseLLM.response
    const distilledLabels = responseLLM.label // labels distilled from the command

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: index, type, task
      unitNow.index = countTemp
      unitNow.type = typeAct
      unitNow.task = task
      // update unit: selectedDataItem
      unitNow.selectedDataItem = selectedIds
      // update unit: feedbackSpeech 
      createTextResponseBySystem({ responseText, mainstore })

      if (selectedIds.length > 0) {
        // highlight selected using ids
        highlightDataItemsByID({ ids: unitNow.selectedDataItem || [], mainstore: mainstore })
        // render the effect: modify spec
        unitNow.modifyType = SpecModifyType.Other
        mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
      }

      // check last unit to show aid with selected highlight
      if (unitLast
        && unitLast?.isAidOn
        && unitLast.isAidOn == true
        && distilledLabels
        && distilledLabels.length > 0) {
        // update unit
        unitNow.status = InteractStatus.Ongoing

        highlightGridCell({ labels: _.map(distilledLabels, o => o.toString()), gridCells: unitLast?.overlayGrids || [] })

        // hide the aid after some time
        const timeoutId = setTimeout(() => {
          // update unit
          unitNow.isAidOn = false
          unitNow.status = InteractStatus.End
          unitNow.isEffective = true // mark the actual selection by the user
          // end of task
          mainstore.count += 1

          // hide aids
          const svg = d3.select("#chart-overlay");
          svg.transition().duration(500).style("visibility", "hidden");

          // recover chart org grids: only needs for grids drawing
          switchChartGrids(true, mainstore)
          // render: spec change 
          // unitNow.modifyType = SpecModifyType.Other
          // mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender

          // act for task
          actFunctionT1({ mainstore })

          // console.log("unitNow", toJS(unitNow));
          // console.log("mainstore", toJS(mainstore));
        }, mainstore.ambiguityFlag.duration);
        mainstore.ambiguityFlag.hideAidTimerID = timeoutId
      } else {// no aids in last unit
        // update unit
        unitNow.status = InteractStatus.End
        unitNow.isEffective = true // mark the actual selection by the user
        // end of task
        mainstore.count += 1

        // act for task
        // FIXME: carefully handle timeout
        setTimeout(() => {
          // act for task
          actFunctionT1({ mainstore })

          // console.log("unitNow", toJS(unitNow));
          // console.log("mainstore", toJS(mainstore));
        }, mainstore.ambiguityFlag.duration);
      }
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
  T2: ({ transcript, responseLLM, mainstore }: { transcript: string; responseLLM: any, mainstore: MainStore }) => {
    console.log(`T2 ...`)
    const typeAct = responseLLM.type
    const task = responseLLM.task
    const responseText = responseLLM.response
    const distilledDomains = responseLLM.domain
    const distilledLabels = responseLLM.label // labels distilled from the command

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: index, type, task
      unitNow.index = countTemp
      unitNow.type = typeAct
      unitNow.task = task
      // update unit: feedbackSpeech 
      createTextResponseBySystem({ responseText, mainstore })

      // update unit: domain
      unitNow.newDomain = distilledDomains

      // check last unit to show aid with selected highlight
      if (unitLast
        && unitLast?.isAidOn
        && unitLast.isAidOn == true
        && distilledLabels
        && distilledLabels.length > 0) {
        // update unit
        unitNow.status = InteractStatus.Ongoing

        highlightGridCell({ labels: _.map(distilledLabels, o => o.toString()), gridCells: unitLast?.overlayGrids || [] })

        // hide the aid after some time
        const timeoutId = setTimeout(() => {
          // update unit
          unitNow.isAidOn = false
          unitNow.status = InteractStatus.End
          unitNow.isEffective = true // mark the actual zoom/pan by the user
          // end of task
          mainstore.count += 1

          // hide aids
          const svg = d3.select("#chart-overlay");
          svg.transition().duration(500).style("visibility", "hidden");

          // recover chart org grids: only needs for grids drawing
          switchChartGrids(true, mainstore)
          // render: spec change 
          // unitNow.modifyType = SpecModifyType.Other
          // mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender

          // act for task
          actFunctionT2({ mainstore })

          // console.log("unitNow", toJS(unitNow));
          // console.log("mainstore", toJS(mainstore));
        }, mainstore.ambiguityFlag.duration);
        mainstore.ambiguityFlag.hideAidTimerID = timeoutId
      } else {// no aids in last unit
        // update unit
        unitNow.status = InteractStatus.End
        unitNow.isEffective = true // mark the actual selection by the user
        // end of task
        mainstore.count += 1

        // act for task
        // FIXME: carefully handle timeout
        setTimeout(() => {
          // act for task
          actFunctionT2({ mainstore })

          // console.log("unitNow", toJS(unitNow));
          // console.log("mainstore", toJS(mainstore));
        }, mainstore.ambiguityFlag.duration);
      }
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
  T3: ({ transcript, responseLLM, mainstore }: { transcript: string; responseLLM: any, mainstore: MainStore }) => {
    console.log(`T3 ...`)

    // unpack LLM response
    const typeAct = responseLLM.type
    const task = responseLLM.task
    let paramsAct = responseLLM.params
    const responseText = responseLLM.response

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: index, type, task
      unitNow.index = countTemp
      unitNow.type = typeAct
      unitNow.task = task
      unitNow.status = InteractStatus.End
      // end of task
      mainstore.count += 1
      // update unit: feedbackSpeech 
      createTextResponseBySystem({ responseText, mainstore })

      // if (task == InteractTask.Aggregate) {
      if (paramsAct && paramsAct.length > 0) {
        // execute one by one
        _.forEach(paramsAct, o => {
          console.log("T3: ", o);

          const attrTemp = o.column
          const opTemp = o.parameter
          const valid = o.valid

          // check if the operation is valid
          if (valid) {
            actFunctionT3({
              task: task,
              attributeAct: attrTemp,
              operationAct: opTemp,
              mainstore: mainstore
            })

            // render the effect: modify spec
            unitNow.modifyType = SpecModifyType.Other
            mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender

            console.log("unitNow", toJS(unitNow));
            console.log("mainstore", toJS(mainstore));
          }
        })
      }
      // } else if (task == InteractTask.Sort) {}
      else {
        mainstore.isCommandSupported = false
        console.log("No matching task in T3.");
      }
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
  T5: ({ transcript, responseLLM, mainstore }: { transcript: string; responseLLM: any, mainstore: MainStore }) => {
    console.log(`temp ...`)
    const typeAct = responseLLM.type
    const task = responseLLM.task
    // const responseText = responseLLM.response

    const unitNow = mainstore.unitNow
    const unitLast = mainstore.interactions.at(-2)
    const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number

    if (unitNow) {
      // update unit: index, type, task
      unitNow.index = countTemp
      unitNow.type = typeAct
      unitNow.task = task
      unitNow.status = InteractStatus.End
      // end of task
      mainstore.count += 1
      // update unit: feedbackSpeech 
      createTextResponseBySystem({ responseText: `${task} is done.`, mainstore: mainstore })

      // call act function
      actFunctionT5({ mainstore })

      console.log("unitNow", toJS(unitNow));
      console.log("mainstore", toJS(mainstore));
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null.");
    }
  },
};


// -------------------------T1------------------------
// define atomic actions corresponding to tasks
// merge T1 and T1
export function actFunctionT1V_1({ mainstore }: {
  mainstore: MainStore;
}) {
  const unitNow = mainstore.unitNow

  if (unitNow && unitNow.type == "T1" && unitNow.selectedDataItem && unitNow.selectedDataItem.length > 0) {// make sure some items are selected
    const task = unitNow.task

    // action for select and highlight already shown
    if (task == InteractTask.Select) {
      console.log("select data");

      // update selected items into store
      updateSelectedItemsSV({ mainstore })
    }
    else if (task == InteractTask.InclusiveFilter || task == InteractTask.ExclusiveFilter) {
      console.log("filter data");

      // decide what data to keep based on task
      const currentData = unitNow.chartSpec.data.values
      let removeIds: string[] = []
      if (unitNow.task == InteractTask.InclusiveFilter) {
        _.forEach(currentData, (item, index) => {
          let flag = _.includes(unitNow.selectedDataItem, item.id)
          if (flag == false) removeIds.push(item.id)
        })
      } else {
        removeIds = unitNow.selectedDataItem
      }

      // update spec
      unitNow.chartSpec.data.values = unitNow.chartSpec.data.values.filter(d =>
        !_.includes(removeIds, d.id))
      // store new data
      unitNow.newData = unitNow.chartSpec.data.values.filter(d =>
        !_.includes(removeIds, d.id))

      // render: data change
      unitNow.modifyType = SpecModifyType.Data
      mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
    } else if (task == InteractTask.ShowDetails) {
      console.log("show details");
      // FIXME: implement
      showTooltip4DetailSV({ ids: unitNow.selectedDataItem, mainstore: mainstore })
    } else {
      console.log("No matching task in T1.");
    }
  } else if (unitNow
    && unitNow.type == "T2"
    // && (unitNow.task == InteractTask.Zoom || unitNow.task == InteractTask.Pan)
    && unitNow.newDomain
    && unitNow.newDomain.xDomain.length > 0) {
    console.log("zoom/pan");

    // adjust domain with padding
    // transfer coords to domain
    // unitNow.newDomain.xDomain = [mainstore.xyScales.xInvert(unitNow.newDomain.xDomain[0]),
    // mainstore.xyScales.xInvert(unitNow.newDomain.xDomain[1])
    // ]
    // unitNow.newDomain.yDomain = [mainstore.xyScales.yInvert(unitNow.newDomain.yDomain[0]),
    // mainstore.xyScales.yInvert(unitNow.newDomain.yDomain[1])
    // ]
    unitNow.newDomain.xDomain = [
      _.floor(Math.min(unitNow.newDomain.xDomain[0] - Math.abs(unitNow.newDomain.xDomain[0]) * 0.2, 0)),
      _.ceil(unitNow.newDomain.xDomain[1] + Math.min(Math.abs(unitNow.newDomain.xDomain[1]) * 0.2, 1))]
    unitNow.newDomain.yDomain = [
      _.floor(Math.min(unitNow.newDomain.yDomain[0] - Math.abs(unitNow.newDomain.yDomain[0]) * 0.2, 0)),
      _.ceil(unitNow.newDomain.yDomain[1] + Math.min(Math.abs(unitNow.newDomain.yDomain[1]) * 0.2, 1))]

    // adjust the domain of the spec
    adjustScale(unitNow.chartSpec, unitNow.newDomain?.xDomain, unitNow.newDomain?.yDomain)

    // render the effect: modify domain
    unitNow.modifyType = SpecModifyType.Domain
    mainstore.renderFlags.smooth = !mainstore.renderFlags.smooth
  }
  else {
    mainstore.isCommandSupported = false
    console.log("unitNow is null or no selected items.");
  }
}

export function actFunctionT1({ mainstore }: {
  mainstore: MainStore;
}) {
  const unitNow = mainstore.unitNow

  if (unitNow
    && unitNow.selectedDataItem
    && unitNow.selectedDataItem.length
    && unitNow.selectedDataItem.length > 0) {// make sure some items are selected
    const task = unitNow.task

    // action for select and highlight already shown
    if (task == InteractTask.Select) {
      console.log("select data");

      // update selected items into store
      updateSelectedItemsSV({ mainstore })

      // render: data change
      unitNow.modifyType = SpecModifyType.Other
      mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
    } else if (task == InteractTask.InclusiveFilter || task == InteractTask.ExclusiveFilter) {
      console.log("filter data");

      // decide what data to keep based on task
      const currentData = unitNow.chartSpec.data.values
      let removeIds: string[] = []
      if (unitNow.task == InteractTask.InclusiveFilter) {
        _.forEach(currentData, (item, index) => {
          let flag = _.includes(unitNow.selectedDataItem, item.id)
          if (flag == false) removeIds.push(item.id)
        })
      } else {
        removeIds = unitNow.selectedDataItem
      }

      // update spec
      unitNow.chartSpec.data.values = unitNow.chartSpec.data.values.filter(d =>
        !_.includes(removeIds, d.id))
      // store new data
      unitNow.newData = unitNow.chartSpec.data.values.filter(d =>
        !_.includes(removeIds, d.id))

      // render: data change (original grids may be losing in this render if previously switch off)
      unitNow.modifyType = SpecModifyType.Data
      mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
    } else if (task == InteractTask.ShowDetails) {
      console.log("show details");
      // FIXME: implement
      showTooltip4DetailSV({ ids: unitNow.selectedDataItem, mainstore: mainstore })

      // render: data change
      unitNow.modifyType = SpecModifyType.Other
      mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
    } else {
      console.log("No matching task in T1.");
    }
  } else {
    mainstore.isCommandSupported = false
    console.log("unitNow is null or no selected items.");
  }
}

export function actFunctionT2({ mainstore }: {
  mainstore: MainStore;
}) {
  const unitNow = mainstore.unitNow

  if (mainstore.chartType == ChartType.Scatter) {
    if (unitNow
      && unitNow.newDomain
      && unitNow.newDomain.xDomain
      && unitNow.newDomain.yDomain
      && unitNow.newDomain.xDomain.length
      && unitNow.newDomain.yDomain.length
      && unitNow.newDomain.xDomain.length > 0
      && unitNow.newDomain.yDomain.length > 0) {
      console.log("zoom/pan");

      // adjust domain with padding
      // transfer coords to domain
      // unitNow.newDomain.xDomain = [mainstore.xyScales.xInvert(unitNow.newDomain.xDomain[0]),
      // mainstore.xyScales.xInvert(unitNow.newDomain.xDomain[1])
      // ]
      // unitNow.newDomain.yDomain = [mainstore.xyScales.yInvert(unitNow.newDomain.yDomain[0]),
      // mainstore.xyScales.yInvert(unitNow.newDomain.yDomain[1])
      // ]

      unitNow.newDomain.xDomain = [
        _.floor(Math.min(unitNow.newDomain.xDomain[0] - Math.abs(unitNow.newDomain.xDomain[0]) * 0.2, 0)),
        _.ceil(unitNow.newDomain.xDomain[1] + Math.min(Math.abs(unitNow.newDomain.xDomain[1]) * 0.2, 1))]
      unitNow.newDomain.yDomain = [
        _.floor(Math.min(unitNow.newDomain.yDomain[0] - Math.abs(unitNow.newDomain.yDomain[0]) * 0.2, 0)),
        _.ceil(unitNow.newDomain.yDomain[1] + Math.min(Math.abs(unitNow.newDomain.yDomain[1]) * 0.2, 1))]

      // adjust the domain of the spec
      adjustScale(unitNow.chartSpec, unitNow.newDomain?.xDomain, unitNow.newDomain?.yDomain)

      // render the effect: modify domain
      unitNow.modifyType = SpecModifyType.Domain
      mainstore.renderFlags.smooth = !mainstore.renderFlags.smooth

      // setTimeout(() => {
      //   unitNow.modifyType = SpecModifyType.Other
      //   mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
      // }, 500);
    } else {
      mainstore.isCommandSupported = false
      console.log("unitNow is null or no valid domain.");
    }
  }
}

// ----------- T3: aggregate and sort task -----------
function actFunctionT3({ task, attributeAct, operationAct, mainstore }: {
  task: string;
  attributeAct: string;
  operationAct: string;
  mainstore: MainStore;
}) {
  const unitNow = mainstore.unitNow

  if (unitNow) {
    const chartSpec = unitNow.chartSpec
    if (chartSpec) {
      let flag = false
      _.forEach(chartSpec.encoding, function (o, key) {
        if (o['field'] && o['field'].toLowerCase() == attributeAct.toLowerCase()) {
          flag = true

          // update spec to include operation
          chartSpec.encoding[key][task] = operationAct.toLowerCase()

          // FIXME: not work for channels beyond x and y, same case for remove sort or aggregate
          // update title to show the operation, and highlight
          o['axis'] = o['axis'] || {}
          // update title to make sure aggregation shown in title
          chartSpec.encoding[key].axis['title'] = _.capitalize(operationAct) + "(" + (o['axis'].title ? o['axis'].title : attributeAct) + ")"

          // if (o['axis'].title) {// only need to deal with when title exist, if not exist, vega-lite will add the info automatically
          // delete title directly to make sure title is automatically generated [or I will have to deal with title when undo aggregate]
          // delete chartSpec.encoding[key].axis.title
          // }

          // update title color to highlight
          chartSpec.encoding[key].axis["titleColor"] = LabelStyleDef.fillHighlight

          // break the loop if the channel to aggregate is done
          return false
        }
      })

      if (flag == false) {
        mainstore.isCommandSupported = false
      }
    } else {
      console.log("unitNow's chartSpec is null.");
    }
  } else {
    console.log("unitNow is null.");
  }
}

function actFunctionT5({ mainstore }: { mainstore: MainStore; }) {
  const unitNow = mainstore.unitNow

  if (unitNow) {
    if (unitNow.task == InteractTask.Reset) {
      // set to org spec
      unitNow.chartSpec = mainstore.specification_org

      // hide svg overlay
      switchSVGOverlay(false)

      //hide detail
      switchTooltipOverlay(false)

      // render the effect: modify spec
      unitNow.modifyType = SpecModifyType.Other
      mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
    } else if (unitNow.task == InteractTask.ClearSelect) {
      if (mainstore.selectedItems.length > 0) {
        // remove selected items, update unit status
        mainstore.selectedItems = []
        mainstore.interactions.forEach(unit => {
          if (unit.task == InteractTask.Select && unit.isEffective)
            unit.isEffective = false
        })

        // remove highlight
        removeHighlightDataItems({ mainstore: mainstore })

        // render the effect: modify spec
        unitNow.modifyType = SpecModifyType.Other
        mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
      } else {
        // inform user to select first
        const responseText = `"No selected items to unselect.`
        createTextResponseBySystem({ responseText, mainstore })
        console.log("No selected items to unselect.");
      }
    } else if (unitNow.task == InteractTask.Unhighlight) {
      // remove highlight
      removeHighlightDataItems({ mainstore: mainstore })

      // render the effect: modify spec
      unitNow.modifyType = SpecModifyType.Other
      mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
    } else if (unitNow.task == InteractTask.ClearFilter) {
      // set to org spec
      unitNow.chartSpec.data.values = mainstore.dataItemsOrg

      // render the effect: modify spec
      unitNow.modifyType = SpecModifyType.Data
      mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
    } else if (unitNow.task == InteractTask.ZoomOut || unitNow.task == InteractTask.PanOut) {
      // ChartExpanding: x and y domain
      // set to org domain
      const chartSpec = unitNow.chartSpec

      chartSpec['params'] = chartSpec['params'] || []
      let paramIndex = _.findIndex(chartSpec['params'], o => o.name == "xDomain")
      if (paramIndex > -1) {
        chartSpec['params'][paramIndex].value = mainstore.domainsOrg.xDomain
      } else {
        chartSpec['params'].push({
          name: "xDomain",
          value: mainstore.domainsOrg.xDomain
        })
      }

      paramIndex = _.findIndex(chartSpec['params'], o => o.name == "yDomain")
      if (paramIndex > -1) {
        chartSpec['params'][paramIndex].value = mainstore.domainsOrg.yDomain
      } else {
        chartSpec['params'].push({
          name: "yDomain",
          value: mainstore.domainsOrg.yDomain
        })
      }

      // render the effect: modify spec
      unitNow.modifyType = SpecModifyType.Domain
      mainstore.renderFlags.smooth = !mainstore.renderFlags.smooth
    } else if (unitNow.task == InteractTask.RemoveAggregation || unitNow.task == InteractTask.RemoveSort) {
      const chartSpec = unitNow.chartSpec
      if (chartSpec && unitNow.task) {
        const task = unitNow.task
        _.forEach(chartSpec.encoding, function (o, key) {
          if (chartSpec.encoding[key][task]) {
            delete chartSpec.encoding[key][task]
            // sort and aggregate will be deleted at the same time for the title
            delete chartSpec.encoding[key].axis['title']
            delete chartSpec.encoding[key].axis["titleColor"]
          }
        })
      } else {
        console.log("unitNow's chartSpec is null or task is null.");
      }
      // render the effect: modify spec
      unitNow.modifyType = SpecModifyType.Other
      mainstore.renderFlags.reRender = !mainstore.renderFlags.reRender
    } else if (unitNow.task == InteractTask.HideDetails) {
      //hide detail
      switchTooltipOverlay(false)
    } else if (unitNow.task == InteractTask.HideGrids || unitNow.task == InteractTask.HideLabels) {
      // hide svg overlay
      switchSVGOverlay(false)
    } else {
      mainstore.isCommandSupported = false
      console.log("No matching task in T5.");
    }
  } else {
    mainstore.isCommandSupported = false
    console.log("unitNow is null.");
  }
}

// update selected items to store
export function updateSelectedItemsSV({ mainstore }: { mainstore: MainStore }) {
  // Filter units where selectedDataItem is a non-empty array
  const selectRelatedUnits = mainstore.interactions.filter(unit => {
    if (
      unit.task == "select"
      && unit.selectedDataItem != undefined
      && unit.selectedDataItem.length > 0
      && unit.isEffective == true) return true
    else return false
  })
  // console.log("filtered units", JSON.parse(JSON.stringify(selectRelatedUnits)));

  let selectedItems = []// ids of the selected data items
  selectRelatedUnits.forEach(unit => selectedItems = _.concat(selectedItems, unit.selectedDataItem))
  // get unique values from the list
  selectedItems = _.uniq(selectedItems)
  console.log("track selectedItems", selectedItems);

  // update info into store
  mainstore.selectedItems = selectedItems
}

// only select and highlight will update param of the spec
export function highlightDataItemsByID({ ids, mainstore }: {
  ids: string[];
  mainstore: MainStore;
}) {
  // console.log("highlightDataItems ids", ids)
  const interactUnitNow = mainstore.unitNow

  if (interactUnitNow) {
    const spec = interactUnitNow.chartSpec
    // console.log("highlightDataItems in spec", toJS(spec));

    // 1. build params for highlight
    const param = {
      "name": "highlightList",
      "value": ids
    }
    // const params = [param]

    // 2. create conditional encoding using opacity channel
    const opacityEncoding = {
      "condition": {
        "test": "indexof(highlightList, datum.id) >= 0",
        "value": 1
      },
      "value": 0.3
    }

    // 3. update spec to have conditional encoding
    spec['params'] = spec['params'] || []
    let paramIndex = _.findIndex(spec['params'], o => o.name == "highlightList")
    if (paramIndex > -1) {
      spec['params'][paramIndex].value = ids
    } else {
      spec['params'].push(param)
    }

    spec.encoding['opacity'] = opacityEncoding
    console.log("highlightDataItems out spec", toJS(spec));

    // adapt for highlight task: make sure highlight task is updated into store
    // mainstore.highlightIndicator.isHighlight = true
  } else {
    console.log("interactUnitNow is null.");
  }
}

export function removeHighlightDataItems({ mainstore }: {
  mainstore: MainStore;
}) {
  // console.log("highlightDataItems ids", ids);

  const unitNow = mainstore.unitNow
  if (unitNow) {
    const spec = unitNow.chartSpec
    // console.log("highlightDataItems in spec", toJS(spec));

    // recover opacity channel
    const opacityEncoding = {
      "value": 1
    }

    // update spec to have the changed encoding
    spec.encoding['opacity'] = opacityEncoding
    console.log("removeHighlightDataItems out spec", toJS(spec));

    // adapt for highlight task: make sure highlight task is updated into store
    // mainstore.highlightIndicator.isHighlight = false
  } else {
    console.log("unitNow is null.");
  }
}

// ----------- show detail task -----------
export function showTooltip4DetailSV({ ids, mainstore }: {// show details for data items
  ids: string[];
  mainstore: MainStore;
}) {
  console.log("ids", toJS(ids));
  const tooltip = document.getElementById("chart-tooltip");
  const dataItems = mainstore.unitNow?.chartSpec.data.values

  let actionFlag = true
  if (tooltip && dataItems && ids.length > 0) {
    // show details for the first selected item: find only one item
    const detailItem = _.find(dataItems, d => _.includes([ids[0]], d.id));
    console.log('detailItem', toJS(detailItem));

    if (detailItem) {
      const gap = 6; // Position the tooltip with a small gap
      tooltip.style.visibility = "visible";
      tooltip.style.left = `${detailItem.xCoord + gap + mainstore.gTransform.x}px`;
      tooltip.style.top = `${detailItem.yCoord + gap + mainstore.gTransform.y}px`;

      _.forEach(detailItem, (value, key) => {
        // only show original attributes
        if (!_.includes(['xCoord', 'yCoord', 'id', 'label'], key)) {
          const lineDiv = document.createElement("div");
          lineDiv.textContent = `${key}: ${value}`;
          tooltip.appendChild(lineDiv)
        }
      });
    } else {
      actionFlag = false
    }

    if (ids.length > 1 && actionFlag) {// many items to show details
      // multiple items
      // const detailItems = _.filter(dataItems, d => _.includes(ids, d.id));
      // console.log('detailItems', toJS(detailItems));

      const responseText = `"The detail of #1 item has been shown. Speech again for other details.`
      createTextResponseBySystem({ responseText, mainstore })
    }
  } else {
    actionFlag = false
  }

  if (actionFlag == false) {// fail to show details
    // inform the user
    const responseText = `"Fail to show details. Please re-try.`
    createTextResponseBySystem({ responseText, mainstore })
    // console.log("fail to show details.");
  }
}

// may be deprecated
// only suitable for single item tooltip
export function showTooltip4Detail({ ids, mainstore }: {
  ids: string[];
  mainstore: MainStore;
}) {
  console.log("ids", ids);
  ids = [ids[0]]
  const tooltip = document.getElementById("chart-tooltip");
  const dataItems = mainstore.unitNow?.chartSpec.data.values

  let actionFlag = true
  if (tooltip && dataItems) {
    // check if mark labels have been drawn
    const svg = d3.select("#chart-overlay");
    let duration = 0
    if (svg.selectAll(".item-label").empty()) {// no lables be drawn
      drawLabel4TargetMarks({
        ids: mainstore.selectedItems,
        mainstore: mainstore,
        labelStyle: { fontSize: 13, color: "gray", dx: 8, dy: 8 }
      })
      duration = 1
    }

    // highlight selected labels
    highlightLabelsbyIds({ ids: ids })

    setTimeout(() => {
      switchSVGOverlay(false)// hide mark labels

      // find only one item
      const detailItem = _.find(dataItems, d => _.includes(ids, d.id));
      console.log('detailItems', toJS(detailItem));
      if (detailItem) {
        const gap = 6; // Position the tooltip with a small gap
        tooltip.style.visibility = "visible";
        tooltip.style.left = `${detailItem.xCoord + gap + mainstore.gTransform.x}px`;
        tooltip.style.top = `${detailItem.yCoord + gap + mainstore.gTransform.y}px`;

        _.forEach(detailItem, (value, key) => {
          // FIXME: only show original attributes
          if (!_.includes(['xCoord', 'yCoord', 'id', 'label'], key)) {
            const lineDiv = document.createElement("div");
            lineDiv.textContent = `${key}: ${value}`;
            tooltip.appendChild(lineDiv)
          }
        });
        // tooltip.textContent = `${Object.entries(detailItem)
        //   .map(([key, item], index) => {
        //     return `${key}: ${item} <br>`
        //   }).join("<br>")}`
      }
    }, (duration + 1) * 1000)
  } else {
    actionFlag = false
  }

  if (actionFlag == false) {// fail to change color
    // inform the user
    const responseText = `"Fail to show details. Please re-try.`
    createTextResponseBySystem({ responseText, mainstore })
    console.log("fail to show details.");
  }
}


// -----------------------------design for grids-----------------------------
export enum GridType {
  X = 'X', // vertical
  Y = 'Y', // horizontal
  XY = 'XY', // mix
  Whole = 'Whole', // one grid for highlighting
}

export enum GridStyleDef {
  strokeColor = '#4169E1',
  strokeColorHighlight = 'red',
  strokeWidth = 1,
  strokeWidthHighlight = 3,
  fill = 'none',
  fillHighlight = 'lightblue',
}

export enum LabelStyleDef {
  fill = '#4169E1',
  fillHighlight = 'red',
  fontSize = 13,
  fontSizeHighlight = 20,
  dx = 7,
  dy = 7,
}

export type GridCell = {
  x: number;
  y: number;
  width: number;
  height: number;
  x2: number;
  y2: number;
  label: string;
}

export interface DrawGridParams {
  chartType?: ChartType;
  gridCells?: GridCell[];
  highlightList?: string[];
  showGridLabels?: boolean;


  // may be deprecated
  svg?: d3.Selection<SVGSVGElement | SVGGElement, unknown, null, undefined>;
  xyCoords?: XYCoords;
  color?: string;
  strokeWidth?: number;
  showLabels?: boolean;
  gridStyle?: GridStyle;
  labelStyle?: LabelStyle;
}

export type XYCoords = {
  xCoords: number[];
  yCoords: number[];
}

export enum Colors {// may be deprecated
  GridStroke = '#4169E1',
  GridStrokeHighlight = 'red',
  GridFill = 'none',
  GridFillHighlight = 'lightblue',
  Label = '#4169E1',
  LabelHighlight = 'red' // used for label highlighting
}

export type GridStyle = {// may be deprecated
  strokeColor: string;
  strokeWidth: number;
  fill: string;
}

export type LabelStyle = {// may be deprecated
  fontSize: number;
  color: string;
  dx: number;
  dy: number;
}

function createGridsSV({
  // scatter plot
  gridType, xDomain, yDomain, deviate, mainstore }:
  {
    gridType: GridType;
    xDomain: number[];
    yDomain: number[];
    deviate: number;// deviate the corrdinates from statistic value to avoid items always on the lines
    mainstore: MainStore
  }) {
  const unitNow = mainstore.unitNow
  if (unitNow) {
    const xyCoords: XYCoords = getXYCoordsSV({
      gridType: gridType,
      xDomain: xDomain,
      yDomain: yDomain,
      deviate: deviate,
      mainstore: mainstore
    })
    const gridCells = generateGridCells(xyCoords)
    // set generates grids to unitNow
    unitNow.overlayGrids = gridCells
    // map grids to items and set into unitNow
    mapGridsToDataItems({ mainstore })
  } else {
    console.log("unitNow is null.");
  }
}

// ChartExpanding
export function getXYCoordsSV({
  // scatter plot
  gridType, xDomain, yDomain, deviate, mainstore }:
  {
    gridType: GridType;
    xDomain: number[];
    yDomain: number[];
    deviate: number;// deviate the corrdinates from statistic value to avoid items always on the lines
    mainstore: MainStore
  }): XYCoords {
  let xCoords: number[] = [];
  let xCoordsDomain: number[] = [];
  let yCoords: number[] = [];
  let yCoordsDomain: number[] = [];

  if (mainstore.chartType == ChartType.Scatter) {
    if (gridType == GridType.XY) {
      const data = mainstore.unitNow?.chartSpec.data.values
      let xField = mainstore.encodingFields['x']
      let yField = mainstore.encodingFields['y']

      let dataTemp = _.filter(data, function (o) {
        if (o[xField] >= xDomain[0] && o[xField] <= xDomain[1]
          && o[yField] >= yDomain[0] && o[yField] <= yDomain[1]
        ) {
          return true
        } else {
          return false
        }
      })

      let xStat = computeStatisticsForQ(dataTemp.map(item => item[xField]))
      let yStat = computeStatisticsForQ(dataTemp.map(item => item[yField]))

      xCoordsDomain = [xDomain[0], xStat.median, xDomain[1]]
      yCoordsDomain = [yDomain[0], yStat.median, yDomain[1]]
    } else if (gridType == GridType.X) {
      const data = mainstore.unitNow?.chartSpec.data.values
      let xField = mainstore.encodingFields['x']

      let dataTemp = _.filter(data, function (o) {
        if (o[xField] >= xDomain[0] && o[xField] <= xDomain[1]
        ) {
          return true
        } else {
          return false
        }
      })

      let xStat = computeStatisticsForQ(dataTemp.map(item => item[xField]))
      xCoordsDomain = [xDomain[0], xStat.Q1, xStat.median, xStat.Q3, xDomain[1]]
      yCoordsDomain = [yDomain[0], yDomain[1]]
    } else if (gridType == GridType.Y) {
      const data = mainstore.unitNow?.chartSpec.data.values
      let yField = mainstore.encodingFields['y']

      let dataTemp = _.filter(data, function (o) {
        if (o[yField] >= yDomain[0] && o[yField] <= yDomain[1]
        ) {
          return true
        } else {
          return false
        }
      })

      let yStat = computeStatisticsForQ(dataTemp.map(item => item[yField]))
      xCoordsDomain = [xDomain[0], xDomain[1]]
      yCoordsDomain = [yDomain[0], yStat.Q1, yStat.median, yStat.Q3, yDomain[1]]
    } else if (gridType == GridType.Whole) {
      xCoordsDomain = [xDomain[0], xDomain[1]]
      yCoordsDomain = [yDomain[0], yDomain[1]]
    }
  }

  // turn domains into coordinates
  xCoords = _.map(xCoordsDomain, (d, index) => {
    if (index == (xCoordsDomain.length - 1)) {
      return Math.min(_.round(mainstore.xyScales.x(d)) + deviate, mainstore.chartWidth)
    } else {// deviate a little bit to make sure items not always on the line
      return Math.max(_.round(mainstore.xyScales.x(d)) - deviate, 0)
    }
  })
  yCoords = _.map(yCoordsDomain, (d, index) => {
    if (index == 0) {
      return Math.min(_.round(mainstore.xyScales.y(d)) + deviate, mainstore.chartHeight)
    } else {
      return Math.max(_.round(mainstore.xyScales.y(d)) - deviate, 0)
    }
  })

  // make sure coords have no redundant value: _.uniq()
  // reverse y to transfer to height of rect: _.reverse()
  const xyCoords: XYCoords = {
    xCoords: _.uniq(xCoords),
    yCoords: _.uniq(_.reverse(yCoords))
  }
  console.log("xyCoords", xyCoords);
  // console.log("xyCoords Domains", xCoordsDomain, yCoordsDomain);

  return xyCoords
}

export function generateGridCells({
  xCoords,
  yCoords
}: XYCoords): GridCell[] {
  // Generate grid cells based on x and y coordinates
  const gridCells: GridCell[] = [];
  for (let row = 0; row < yCoords.length - 1; row++) {
    for (let col = 0; col < xCoords.length - 1; col++) {
      gridCells.push({
        x: xCoords[col],
        y: yCoords[row],
        width: xCoords[col + 1] - xCoords[col],
        height: yCoords[row + 1] - yCoords[row],
        x2: xCoords[col] + (xCoords[col + 1] - xCoords[col]),
        y2: yCoords[row] + (yCoords[row + 1] - yCoords[row]),
        label: gridCells.length + 1 + "", // Example label
      });
    }
  }
  console.log("gridCells Data", gridCells);

  return gridCells;
}

function mapGridsToDataItems({ mainstore }: { mainstore: MainStore }) {
  const unitNow = mainstore.unitNow

  if (unitNow && unitNow.overlayGrids) {
    let mapping: any = {}
    _.forEach(unitNow.overlayGrids, function (o: GridCell) {
      mapping[o.label] = { label: o.label, ids: [] }
    })

    const data = mainstore.unitNow?.chartSpec.data.values
    _.forEach(data, item => {
      let grid = _.find(unitNow.overlayGrids, function (o: GridCell) {
        if (item.xCoord >= o.x && item.xCoord <= o.x2
          && item.yCoord >= o.y && item.yCoord <= o.y2
        ) {
          return true
        } else {
          return false
        }
      })
      if (grid) {
        mapping[grid.label].ids.push(item.id)
      }
    })

    // set into unitNow
    let mappingTemp: Grid2DataItems[] = []
    _.forEach(mapping, (value, key) => {
      mappingTemp.push(value)
    })
    unitNow.gridsToDataItems = mappingTemp
  } else {
    console.log("unitNow is null.");
  }
}


// ChartExpanding
// used to draw grids, applicable to bar, scatter, line, and pie
export function drawGridsSV({
  chartType,
  gridCells,
  highlightList,
  showGridLabels = true,
}: DrawGridParams): void {
  // Set up the SVG
  const svg = d3.select("#chart-overlay");
  // make sure svg is not hidden
  svg.style("visibility", "visible")
  // remove inside elements before drawing new stuff
  svg.selectAll("*").remove();

  // Draw grid rectangles
  svg.selectAll(".grid-cell")
    .data(gridCells)
    .join("rect")
    .attr("class", "grid-cell")
    .attr("x", (d) => d.x)
    .attr("y", (d) => d.y)
    .attr("width", (d) => d.width)
    .attr("height", (d) => d.height)
    .attr("stroke", GridStyleDef.strokeColor)
    .attr("stroke-width", GridStyleDef.strokeWidth)
    .attr("fill", (d: GridCell) => {
      if (_.includes(highlightList, d.label)) {
        return GridStyleDef.fillHighlight
      } else {
        return GridStyleDef.fill
      }
    })
    .attr("opacity", 0.35)

  // Add grid labels if enabled
  if (showGridLabels) {
    svg.selectAll(".item-label")
      .data(gridCells)
      .join("text")
      .attr("class", "item-label")
      .attr("x", (d) => d.x + d.width / 2 + LabelStyleDef.dx) // Center label in cell
      .attr("y", (d) => {
        if (chartType == ChartType.Scatter || chartType == ChartType.Line) {
          return d.y + d.height / 2 + LabelStyleDef.dy
        } else if (chartType == ChartType.Bar || chartType == ChartType.Pie) {
          return d.y - LabelStyleDef.dy
        } else {
          return d.y + d.height / 2 + LabelStyleDef.dy
        }
      })
      .attr("fill", LabelStyleDef.fill)
      .attr("font-size", LabelStyleDef.fontSize)
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .text((d) => d.label);
  }
}

// Programmatically highlight selected grids
export function highlightGridCell({ labels, gridCells }: {
  labels: string[];
  gridCells: GridCell[];
}) {
  // Set up the SVG
  const svg = d3.select("#chart-overlay");

  const flag = gridCells.filter(d => _.includes(labels, d.label));
  if (flag) {
    svg.selectAll(".grid-cell")
      .filter(d => _.includes(labels, d.label))
      .attr("fill", GridStyleDef.fillHighlight)

    // de-highlight none selected grids
    svg.selectAll(".grid-cell")
      .filter(d => !_.includes(labels, d.label))
      .attr("fill", GridStyleDef.fill)
  }
}

// -----------------------------design for labels-----------------------------
export type LabelCoord = {
  id: string;
  label: string;
  x: number;
  y: number;
}

export type LegendMapping = {
  label: string;
  id: string;
  x: number;
  y: number;

  colorOrg: string;
  colorSimple?: string;
  shape?: string;

  value: string;
  ids?: string[];
}

export interface DrawLabelParams {
  chartType?: ChartType;
  labelItems?: LabelCoord[];
  highlightList?: string[];
}

// ChartExpanding
const distillLabelCoordByIdsSV = ({ ids, mainstore }: { ids: string[]; mainstore: MainStore }) => {
  let items: LabelCoord[] = []

  // distill legend labels
  _.forEach(mainstore.legendMapping, (item: LegendMapping, index) => {
    if (_.includes(ids, item.id)) {
      items.push(
        {
          id: item.id,
          label: item.label,
          x: item.x - LabelStyleDef.fontSize, // mitigate the effect of fontsize
          y: item.y
        }
      )
    }
  })

  // distill mark labels
  const data = mainstore.unitNow?.chartSpec.data.values || [] // label is already included in the source data
  _.forEach(data, (item, index) => {
    if (_.includes(ids, item.id)) {
      items.push(
        {
          id: item.id,
          label: item.label,
          x: item.xCoord,
          y: item.yCoord
        }
      )
    }
  })

  console.log('distillLabelCoordByIdsSV', items);
  return items
}

export function drawLabelsSV({// draw labels for selected data items with highlighting included
  chartType,
  labelItems,
  highlightList,
}: DrawLabelParams): void {
  const svg = d3.select("#chart-overlay");
  // make sure svg is not hidden
  svg.style("visibility", "visible")
  // remove inside elements before drawing new stuff
  svg.selectAll("*").remove();

  // Add labels
  svg
    .selectAll(".item-label")
    .data(labelItems)
    .join("text")
    .attr("class", "item-label")
    .attr("x", (d) => d.x + LabelStyleDef.dx) // Center label in cell
    .attr("y", (d) => {
      if (chartType == ChartType.Scatter || chartType == ChartType.Line) {
        return d.y + LabelStyleDef.dy
      } else if (chartType == ChartType.Bar || chartType == ChartType.Pie) {
        return d.y - LabelStyleDef.dy
      } else {
        return d.y + LabelStyleDef.dy
      }
    })
    .attr("fill", (d: LabelCoord) => {
      if (_.includes(highlightList, d.id)) {
        return LabelStyleDef.fillHighlight
      } else {
        return LabelStyleDef.fill
      }
    })
    .attr("font-size", LabelStyleDef.fontSize)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .text((d) => d.label);
}


// may be deprecated
export function drawLabel4Marks({// draw labels for all the current data items
  mainstore,
  labelStyle = { fontSize: 12, color: "#4169E1", dx: 8, dy: 8 }
}: { mainstore: MainStore; labelStyle: LabelStyle }): void {
  const svg = d3.select("#chart-overlay");
  // make sure svg is not hidden
  svg.style("visibility", "visible")
  // remove inside elements before drawing new stuff
  svg.selectAll("*").remove();

  // get coords for labels 
  const labelCoords: LabelCoord[] = distillMarkLabelCoords(mainstore)

  // Add labels
  svg
    .selectAll(".item-label")
    .data(labelCoords)
    .join("text")
    .attr("class", "item-label")
    .attr("x", (d) => d.x + labelStyle.dx) // Center label in cell
    .attr("y", (d) => d.y + labelStyle.dy)
    // .attr("fill", labelStyle.color)
    .attr("fill", Colors.Label)
    .attr("font-size", labelStyle.fontSize)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .text((d) => d.label);
}

const distillMarkLabelCoords = (mainstore: MainStore) => {
  let items: LabelCoord[] = []

  const interactUnitNow = mainstore.unitNow
  if (interactUnitNow) {
    const data = interactUnitNow.chartSpec.data.values
    _.forEach(data, (item, index) => {
      // label is already included in the source data
      items.push(
        { id: item.id, label: item.label, x: item.xCoord, y: item.yCoord }
      )
    })
  }

  console.log('distillMarkLabelCoords', items);
  return items
}


// -------------------------util functions------------------------
export function createTextResponseBySystem({ responseText, mainstore }: { responseText: string, mainstore: MainStore }) {
  if (mainstore.unitNow) {
    // if the command is not supported, inform the user
    const systemResponse: Message = {
      sender: SenderType.System,
      text: responseText,
    };

    mainstore.unitNow.feedbackSpeech = systemResponse

    // enable text to speech
    if (mainstore.speechIndicator.isText2SpeechOn) {
      // Check if the browser supports SpeechSynthesis
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(responseText); // Create a speech synthesis instance

        // Optional: Configure voice, pitch, and rate
        // utterance.voice = "Google US English (en-US)"
        utterance.pitch = 1; // Pitch (range: 0 to 2)
        utterance.rate = 1; // Rate (range: 0.1 to 10)

        // Add event listeners to track speaking status
        utterance.onstart = () => {
          console.log("speak is on.");
        };
        utterance.onend = () => {
          console.log("speak is off.");
        }

        // Speak the text
        window.speechSynthesis.speak(utterance);
      } else {
        console.log(("Sorry, your browser does not support text-to-speech!"))
      }
    } else {
      // console.log(("Text to speech is currently off."))
    }
  } else {
    console.log("unitNow is null.");
  }
}

export function computeStatisticsForQ(dataItems) {
  // Sort the field
  const sortedItems = [...dataItems].sort((a, b) => a - b);

  // Calculate statistics
  const min = sortedItems[0];
  const max = sortedItems[sortedItems.length - 1];

  // Helper function for median
  const median = arr => {
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 === 0
      ? (arr[mid - 1] + arr[mid]) / 2
      : arr[mid];
  };

  // Calculate median
  const med = median(sortedItems);

  // Calculate Q1 and Q3
  const lowerHalf = sortedItems.slice(0, Math.floor(sortedItems.length / 2));
  const upperHalf = sortedItems.length % 2 === 0
    ? sortedItems.slice(Math.floor(sortedItems.length / 2))
    : sortedItems.slice(Math.floor(sortedItems.length / 2) + 1);

  const Q1 = median(lowerHalf);
  const Q3 = median(upperHalf);

  return {
    min: min,
    Q1: Q1,
    median: med,
    Q3: Q3,
    max: max,
  }
}

// callni
export function switchChartGrids(state: boolean, mainstore: MainStore) {
  // const specNow = mainstore.interactions.at(-1)?.chartSpec
  const specNow = mainstore.chartSpec

  // Update the spec to hide/show gridlines
  specNow.encoding.x.axis['grid'] = state;
  specNow.encoding.y.axis['grid'] = state;
}

// callni
export function switchSVGOverlay(state: boolean) {// including grids and mark labels
  const chartOverlay = d3.select("#chart-overlay");
  if (state == true) {
    chartOverlay.style("visibility", "visible")
  } else {
    chartOverlay.style("visibility", "hidden")
  }
}

function switchTooltipOverlay(state: boolean) {
  const chartTooltip = d3.select("#chart-tooltip");
  if (state == true) {
    chartTooltip.style("visibility", "visible")
  } else {
    chartTooltip.style("visibility", "hidden")
  }
}

export function locateIDByLabel(labels: string[], data: any) {
  // add an ID to data items when first rendered 
  // cause labels are changing every re-rendering
  // locate the ids using labels 
  let ids: string[] = []

  // make sure id's order aligns with label's order
  _.forEach(labels, (l, index) => {
    let dataItem = _.find(data, d => d.label == l)
    if (dataItem) ids.push(dataItem.id)
  })

  // ids order not align with labels
  // _.forEach(data, (item, index) => {
  //   let flag = _.includes(labels, item.label)
  //   if (flag) ids.push(item.id)
  // })

  return ids
}

export function filterData(spec, xDomain, yDomain) {
  let filteredData = spec.data.values.filter(d =>
    d.x >= xDomain[0] && d.x <= xDomain[1] &&
    d.y >= yDomain[0] && d.y <= yDomain[1]
  );
  console.log("filterData", JSON.parse(JSON.stringify(filteredData)));

  spec.data.values = filteredData
}

// FIXME: conflict between smooth render
export function adjustScale(spec, xDomain, yDomain) {
  if (spec.encoding.x.scale) {
    spec.encoding.x.scale.domain = xDomain
  } else {
    spec.encoding.x.scale = { domain: xDomain }
  }

  if (spec.encoding.y.scale) {
    spec.encoding.y.scale.domain = yDomain
  } else {
    spec.encoding.y.scale = { domain: yDomain }
  }
}