import {
    makeAutoObservable,
    autorun
} from 'mobx';
import * as _ from 'lodash';
import axios from 'axios';

import {
    AggregationType,
    APIState,
    EncodingType,
    GridCell,
    InteractStatus,
    InteractUnit,
    Message,
    URLBase,
    XYCoords,
    AidState,
    ChartType,
    computeStatisticsForQ,
    LabelCoord,
    LegendMapping
} from './util.tsx';

// 对应用状态进行建模
export class MainStore {
    // enable SpeechViz
    isDataEnhanced: boolean = false // make sure enhancement only execute once

    speech: string = ""
    // isText2SpeechOn: boolean = false
    // LAI YI 3.15 注释：
    speechIndicator = {
        startListening: false,
        setToSleep: false,
        isAwake: false,
        isStopped: false,
        //LAI YI 3.15 下面这两个是适用于count-based的
        // commandLimitNum: 5,
        // restartCount: 0,
        //LAI YI 3.15 下面这个是适用于time-based的
        silenceDuration: 5000, // 5 seconds in milliseconds - configurable value
        //LAI YI 3.15 上述两种方式二选一
        // isText2SpeechOn: false,
        showSpeechControlButtons: true, // show or hide speech start and stop buttons
        // showTypeButton: true, // show or hide typing buttons
        //LAI YI 3.15 新增的属性，适用于增强识别
        grammarEnabled: true, // enable/disable grammar enhancement
        availableCommands: [
            // 基本导航命令
            "wake up", "stop", "help",
            
            // 数据操作命令
            "select", "filter", "highlight", "show details",
            "zoom", "pan", "aggregate", "sort",
            
            // 辅助显示命令
            "show grids", "show labels",
            
            // 撤销/重做命令
            "undo", "redo", "reset",
            
            // 逆向命令
            "clear select", "clear filter", "hide details", "unhighlight",
            "zoom out", "pan out", "remove aggregation", "remove sort",
            "hide grids", "hide labels"
        ], // can be dynamically updated with available commands
        //LAI YI 3.15.3 现在集成所有状态管理到mainstore
        commandTimeoutIDs: [] as number[], // 存储命令超时ID(集成状态管理时我显式指定其为数字数组)
        silenceTimeoutID: null as number | null, // 存储静默超时ID(集成状态管理时我显式允许为数字或null)
    }
    
    apiState: APIState = APIState.Default // record llm calling status

    count: number = 1; // = len(interactions) + 1
    interactions: InteractUnit[] = [];
    redoList: InteractUnit[][] = []; // the structure is similar to interacts

    renderFlags: { reRender: boolean; smooth: boolean; } = { reRender: false, smooth: false } // flip the value to trigger update of the chart
    gTransform = { x: 0, y: 0 } // transform of the current chart
    xyScales: any = {} // scales of the current chart
    domainsOrg: { xDomain: any, yDomain: any } = { xDomain: [], yDomain: [] } // used for zoom out and pan out
    legendMapping: LegendMapping[] = [] // mapping between legend items: label, color/shape, value
    // legendItemCoords: LabelCoord[] = [] // coords for the legend items > merge into legendMapping
    // Important: avoid attribute names to be x and y
    // cause there will be conflicts to distill xy coords and llm's response for x and y axis
    specification_org: any = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": "A scatter plot with more than 20 points across 3 categories.",
        "data": {
            // "values": [
            //     { "rate": 1, "comment": 3, "category": "A" },
            //     { "rate": 2, "comment": 7, "category": "A" },
            //     { "rate": 3, "comment": 6, "category": "A" },
            //     { "rate": 4, "comment": 6, "category": "B" },
            //     { "rate": 5, "comment": 7, "category": "B" },
            //     { "rate": 6, "comment": 8, "category": "B" },
            //     { "rate": 7, "comment": 5, "category": "B" },
            //     { "rate": 8, "comment": 9, "category": "B" },
            //     { "rate": 3, "comment": 4, "category": "C" },
            //     { "rate": 4, "comment": 7, "category": "C" },
            //     { "rate": 5, "comment": 6, "category": "C" },
            //     { "rate": 6, "comment": 5, "category": "C" },
            //     { "rate": 7, "comment": 8, "category": "C" },
            //     { "rate": 8, "comment": 6, "category": "C" },
            //     { "rate": 9, "comment": 7, "category": "C" }
            // ],
            "values": [
                {
                    "rate": 1,
                    "comment": 3,
                    "category": "A",
                    "xCoord": 40,
                    "yCoord": 210,
                    "label": "4",
                    "id": "id4",
                    "color": "blue",
                    "shape": "circle"
                },
                {
                    "rate": 2,
                    "comment": 7,
                    "category": "A",
                    "xCoord": 80,
                    "yCoord": 90,
                    "label": "5",
                    "id": "id5",
                    "color": "blue",
                    "shape": "circle"
                },
                {
                    "rate": 3,
                    "comment": 6,
                    "category": "A",
                    "xCoord": 120,
                    "yCoord": 120,
                    "label": "6",
                    "id": "id6",
                    "color": "blue",
                    "shape": "circle"
                },
                {
                    "rate": 3,
                    "comment": 4,
                    "category": "C",
                    "xCoord": 120,
                    "yCoord": 180,
                    "label": "7",
                    "id": "id7",
                    "color": "orange",
                    "shape": "square"
                },
                {
                    "rate": 4,
                    "comment": 7,
                    "category": "C",
                    "xCoord": 160,
                    "yCoord": 90,
                    "label": "8",
                    "id": "id8",
                    "color": "orange",
                    "shape": "square"
                },
                {
                    "rate": 4,
                    "comment": 6,
                    "category": "B",
                    "xCoord": 160,
                    "yCoord": 120,
                    "label": "9",
                    "id": "id9",
                    "color": "green",
                    "shape": "triangle"
                },
                {
                    "rate": 5,
                    "comment": 7,
                    "category": "B",
                    "xCoord": 200,
                    "yCoord": 90,
                    "label": "10",
                    "id": "id10",
                    "color": "green",
                    "shape": "triangle"
                },
                {
                    "rate": 5,
                    "comment": 6,
                    "category": "C",
                    "xCoord": 200,
                    "yCoord": 120,
                    "label": "11",
                    "id": "id11",
                    "color": "orange",
                    "shape": "square"
                },
                {
                    "rate": 6,
                    "comment": 8,
                    "category": "B",
                    "xCoord": 240,
                    "yCoord": 60,
                    "label": "12",
                    "id": "id12",
                    "color": "green",
                    "shape": "triangle"
                },
                {
                    "rate": 6,
                    "comment": 5,
                    "category": "C",
                    "xCoord": 240,
                    "yCoord": 150,
                    "label": "13",
                    "id": "id13",
                    "color": "orange",
                    "shape": "square"
                },
                {
                    "rate": 7,
                    "comment": 8,
                    "category": "C",
                    "xCoord": 280,
                    "yCoord": 60,
                    "label": "14",
                    "id": "id14",
                    "color": "orange",
                    "shape": "square"
                },
                {
                    "rate": 7,
                    "comment": 5,
                    "category": "B",
                    "xCoord": 280,
                    "yCoord": 150,
                    "label": "15",
                    "id": "id15",
                    "color": "green",
                    "shape": "triangle"
                },
                {
                    "rate": 8,
                    "comment": 9,
                    "category": "B",
                    "xCoord": 320,
                    "yCoord": 30,
                    "label": "16",
                    "id": "id16",
                    "color": "green",
                    "shape": "triangle"
                },
                {
                    "rate": 8,
                    "comment": 6,
                    "category": "C",
                    "xCoord": 320,
                    "yCoord": 120,
                    "label": "17",
                    "id": "id17",
                    "color": "orange",
                    "shape": "square"
                },
                {
                    "rate": 9,
                    "comment": 7,
                    "category": "C",
                    "xCoord": 360,
                    "yCoord": 90,
                    "label": "18",
                    "id": "id18",
                    "color": "orange",
                    "shape": "square"
                }
            ],
        },
        "mark": "point",
        "encoding": {
            "x": {
                "field": "rate",
                "type": "quantitative",
                "axis": { "title": "Rate" }
            },
            "y": {
                "field": "comment",
                "type": "quantitative",
                "axis": { "title": "Comment" }
            },
            "color": {
                "field": "category",
                "type": "nominal",
                "scale": { "scheme": "category10" }
            },
            // "shape": {
            //     "field": "category",
            //     "type": "nominal",
            // },
            // "tooltip": [
            //     { "field": "rate", "type": "quantitative", "title": "Rate" },
            //     { "field": "comment", "type": "quantitative", "title": "Comment" },
            //     { "field": "category", "type": "nominal", "title": "Category" }
            // ]
        },
        "width": 400,
        "height": 300
    }

    ambiguityFlag: { hasAmbiguity: boolean; hideAidTimerID: number | undefined; duration?: number; } = {
        hasAmbiguity: false, hideAidTimerID: undefined, duration: 2000
    } // used to document ambiguity status, and used of clarification
    // isAidsOn: AidState = { grid: false, markLabel: false, legendLabel: false }; // status to show aids (also store in unit)
    selectedItems: string[] = [] // store the ids of selected items
    resetIndicator = { "isReset": true } // used for reset

    constructor() {
        // make attrs and computed attrs auto observable
        makeAutoObservable(this);
        autorun(() => {
            this.enhanceChartSpec4Smooth()
        });
        
        // 初始化语法识别功能
        this.setupSpeechGrammar();
    }

    // 设置语音语法识别增强
    setupSpeechGrammar() {
        // 仅在浏览器环境中运行，避免服务端渲染问题
        if (typeof window !== 'undefined') {
            // 设置默认命令
            this.updateSpeechGrammar(this.speechIndicator.availableCommands);
            
            // 根据图表类型和数据自动添加特定命令
            this.updateCommandsFromChartData();
        }
    }

     // 更新语音语法模型
     //LAI YI 3.16 4.实现增强语音识别的修改
    // updateSpeechGrammar(commands: string[]) {
    //     if (typeof window === 'undefined' || !this.speechIndicator.grammarEnabled) return;
        
    //     try {
    //         // 访问WebKit语音识别API
    //         const SpeechGrammarList = (window as any).SpeechGrammarList || 
    //                                  (window as any).webkitSpeechGrammarList;

    //     if (!SpeechGrammarList) {
    //         console.warn("SpeechGrammarList API 不可用，语法增强将不起作用");
    //         return;
    //     }
            
    //         if (SpeechGrammarList) {
    //             const SpeechRecognition = (window as any).SpeechRecognition || 
    //                                      (window as any).webkitSpeechRecognition;
                                         
    //             if (SpeechRecognition && SpeechRecognition.recognition) {
    //                 // 创建语法列表
    //                 const speechRecognitionList = new SpeechGrammarList();
                    
    //                 // 构建JSGF语法字符串
    //                 const grammar = `#JSGF V1.0; grammar commands; public <command> = ${commands.join(" | ")};`;
                    
    //                 // 添加带权重的语法
    //                 speechRecognitionList.addFromString(grammar, 1);
                    
    //                 // 应用到识别实例
    //                 SpeechRecognition.recognition.grammars = speechRecognitionList;
    //                 SpeechRecognition.recognition.lang = 'en-US';
    //                 SpeechRecognition.recognition.maxAlternatives = 5; // 返回多个候选结果
                    
    //                 console.log("Speech grammar updated with commands:", commands);
    //             }
    //         }
    //     } catch (error) {
    //         console.error("Error setting up speech grammar:", error);
    //     }
    // }
    //LAIYI 3.16 4.实现增强语音识别的修改,确保它能正确访问底层 API 并设置语法模型。
    updateSpeechGrammar(commands: string[]) {
        if (typeof window === 'undefined' || !this.speechIndicator.grammarEnabled) return;
        
        try {
            // 访问WebKit语音识别API
            const SpeechGrammarList = (window as any).SpeechGrammarList || 
                                     (window as any).webkitSpeechGrammarList;
            
            if (!SpeechGrammarList) {
                console.warn("SpeechGrammarList API 不可用，语法增强将不起作用");
                return;
            }
            
            // 获取 SpeechRecognition
            const SpeechRecognition = (window as any).SpeechRecognition || 
                                     (window as any).webkitSpeechRecognition;
            
            if (!SpeechRecognition) {
                console.warn("SpeechRecognition API 不可用");
                return;
            }
            
            // 尝试多种方式获取 recognition 实例
            let recognition;
            
            // 1. 首先尝试通过 react-speech-recognition 暴露的实例
            if (SpeechRecognition.recognition) {
                recognition = SpeechRecognition.recognition;
                console.log("通过 react-speech-recognition 获取到 recognition 实例");
            }
            // 2. 尝试全局实例 (如果存在)
            else if ((window as any).recognition) {
                recognition = (window as any).recognition;
                console.log("通过全局对象获取到 recognition 实例");
            }
            // 3. 尝试创建新实例作为后备
            else {
                try {
                    recognition = new SpeechRecognition();
                    // 保存实例供后续使用
                    (window as any).recognition = recognition;
                    console.log("创建了新的 recognition 实例");
                } catch (error) {
                    console.error("无法创建 SpeechRecognition 实例:", error);
                    return;
                }
            }
            
            // 确保 recognition 可用
            if (!recognition) {
                console.warn("无法获取或创建 SpeechRecognition 实例");
                return;
            }
            
            // 创建语法列表
            const speechRecognitionList = new SpeechGrammarList();
            
            // 过滤掉空命令并去重
            const validCommands = commands.filter(cmd => cmd && cmd.trim()).map(cmd => cmd.trim());
            const uniqueCommands = [...new Set(validCommands)];
            
            if (uniqueCommands.length === 0) {
                console.warn("没有有效的命令可添加到语法中");
                return;
            }
            
            // 构建更健壮的 JSGF 语法字符串
            // 注意：对特殊字符进行转义，防止语法错误
            const safeCommands = uniqueCommands.map(cmd => 
                cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
            );
            
            const grammar = `#JSGF V1.0; grammar commands; public <command> = ${safeCommands.join(" | ")};`;
            
            // 添加带权重的语法
            speechRecognitionList.addFromString(grammar, 1);
            
            // 应用到识别实例
            recognition.grammars = speechRecognitionList;
            recognition.lang = 'en-US';
            recognition.maxAlternatives = 5; // 返回多个候选结果
            
            // 可选：设置其他有用的参数
            recognition.continuous = true; // 持续识别
            recognition.interimResults = false; // 只返回最终结果
            
            console.log("语音语法已更新，包含以下命令:", uniqueCommands);
            
        } catch (error) {
            console.error("设置语音语法时出错:", error);
        }
    }
    
    // 从图表数据中提取可能的命令
    updateCommandsFromChartData() {
        const commands = [...this.speechIndicator.availableCommands];
        
        try {
            // 添加图表特有的属性和值作为可能的命令
            if (this.specification_org?.encoding) {
                // 添加轴标题
                if (this.specification_org.encoding.x?.axis?.title) {
                    commands.push(this.specification_org.encoding.x.axis.title);
                }
                if (this.specification_org.encoding.y?.axis?.title) {
                    commands.push(this.specification_org.encoding.y.axis.title);
                }
                
                // 添加分类值
                if (this.specification_org.encoding.color?.field) {
                    commands.push(this.specification_org.encoding.color.field);
                    
                    // 如果是分类数据，添加所有唯一值
                    if (this.specification_org.encoding.color.type === 'nominal') {
                        const uniqueValues = _.uniq(
                            this.specification_org.data.values.map(item => item[this.specification_org.encoding.color.field])
                        );
                        commands.push(...uniqueValues);
                    }
                }
            }
            
            // 更新命令列表
            this.speechIndicator.availableCommands = _.uniq(commands);
            
            // 更新语法模型
            this.updateSpeechGrammar(this.speechIndicator.availableCommands);
            
        } catch (error) {
            console.error("Error updating commands from chart data:", error);
        }
    }



    // autorun function when initialing store
    enhanceChartData() {
        // FIXME: leverage spec to distill color and shape into data

    }

    enhanceChartSpec4Smooth() {
        // FIXME: avoid there is no scale in x and y
        if (this.chartType == ChartType.Scatter) {
            this.specification_org['encoding']['x']['scale'] = this.specification_org['encoding']['x']['scale'] || {}
            this.specification_org['encoding']['y']['scale'] = this.specification_org['encoding']['y']['scale'] || {}
        }
    }

    //LAI YI 3.15.3 新增的方法，集成所有状态管理到mainstore
        // 在这里添加新方法
        // resetSilenceTimeout() {
        //     this.clearSilenceTimeout();
        //     this.speechIndicator.silenceTimeoutID = window.setTimeout(() => {
        //         console.log(`Silence detected for ${this.speechIndicator.silenceDuration/1000} seconds. Stopping listening...`);
        //         this.speechIndicator.setToSleep = true; // 如果检测到静默，则进入休眠模式
        //     }, this.speechIndicator.silenceDuration);
        // }
        resetSilenceTimeout() {
            this.clearSilenceTimeout();
            this.speechIndicator.silenceTimeoutID = window.setTimeout(() => {
                // 只有在系统仍处于唤醒状态时才需要休眠
                if (this.speechIndicator.isAwake) {
                    console.log(`Silence detected for ${this.speechIndicator.silenceDuration/1000} seconds. Stopping listening...`);
                    this.speechIndicator.setToSleep = true;
                }
            }, this.speechIndicator.silenceDuration);
        }
    
        clearSilenceTimeout() {
            if (this.speechIndicator.silenceTimeoutID) {
                clearTimeout(this.speechIndicator.silenceTimeoutID);
                this.speechIndicator.silenceTimeoutID = null;
            }
        }
    
        clearCommandTimeouts() {
            this.speechIndicator.commandTimeoutIDs.forEach((timeoutId) => {
                clearTimeout(timeoutId);
            });
            this.speechIndicator.commandTimeoutIDs = [];
        }
    
        addCommandTimeout(timeoutId) {
            this.speechIndicator.commandTimeoutIDs.push(timeoutId);
        }
    
        removeCommandTimeout(timeoutId) {
            this.speechIndicator.commandTimeoutIDs = this.speechIndicator.commandTimeoutIDs.filter(id => id !== timeoutId);
        }
        //完成添加新方法
    // compute attribute
    get chartSpec() {
        return this.interactions.length > 0 ?
            this.interactions.at(-1)?.chartSpec
            : this.specification_org;
    }

    get chartType() {
        let chartType: ChartType = ChartType.Other
        if (this.specification_org.mark == 'point')
            chartType = ChartType.Scatter
        // FIXME: deal with group bar chart
        else if (this.specification_org.mark == 'bar')
            chartType = ChartType.Bar
        else if (this.specification_org.mark == 'line')
            chartType = ChartType.Line
        else if (this.specification_org.mark == 'arc')
            chartType = ChartType.Pie
        else
            chartType = ChartType.Other

        return chartType
    }

    get chartWidth() {
        return this.specification_org.width
    }

    get chartHeight() {
        return this.specification_org.height
    }

    get unitNow() {
        return this.interactions.length > 0 ?
            this.interactions.at(-1)
            : undefined;
    }

    // distill attrs of the chart and their encodings
    get attr2Encoding() {
        const attr2EncodingTemp: any = []

        _.map(this.specification_org.encoding, (item, key) => {
            if (_.includes(['x', 'y', 'color', 'shape'], key)) {
                attr2EncodingTemp.push({
                    field: item.field,
                    type: item.type,
                    channel: key,
                })
            }
        });

        return attr2EncodingTemp
    }

    // mapping between channel and field, e.g., x: rate
    get encodingFields() {
        const fields = {}
        _.forEach(this.attr2Encoding, item => fields[item.channel] = item.field)

        return fields
    }

    // work for scatter
    // statistic info for data in unitNow: min, Q1, median, Q3, max
    get statisticForQs() {
        const stats = {}
        // const padding = 1
        if (this.unitNow && this.unitNow.chartSpec) {
            _.forEach(this.attr2Encoding, item => {
                if (item.type == "quantitative") {
                    // Extract field values
                    const data = this.unitNow?.chartSpec.data.values
                    const dataItems = data.map(o => o[item.field]);
                    const temp = computeStatisticsForQ(dataItems)
                    stats[item.channel] = {
                        field: item.field,
                        min: temp.min,
                        Q1: temp.Q1,
                        median: temp.median,
                        Q3: temp.Q3,
                        max: temp.max,
                    }
                }
            })
        } else {
            console.log("unitNow is null or no data.");
        }

        return stats
    }

    // distill data table of the chart
    get dataItemsOrg() {
        return this.specification_org.data.values
    }


    // enable speech-based workflow (maybe deprecated)
    isCommandSupported: boolean = true // mark if the command is supported, for the ease of creating system response
    nextTask: string = "" // record the next task for save llm call

    update_flag = true

    selectIndicator = {
        "numberOfDataItems4Grid": 10, // use number of data items to draw grid or mark labels for selection
    }// used for select
    navigationGrids: GridCell[] = [
        // {
        //     "x": 0,
        //     "y": 0,
        //     "width": 133,
        //     "height": 100,
        //     "label": "1"
        // },
        // {
        //     "x": 133,
        //     "y": 0,
        //     "width": 134,
        //     "height": 100,
        //     "label": "2"
        // },
        // {
        //     "x": 267,
        //     "y": 0,
        //     "width": 133,
        //     "height": 100,
        //     "label": "3"
        // },
        // {
        //     "x": 0,
        //     "y": 100,
        //     "width": 133,
        //     "height": 100,
        //     "label": "4"
        // },
        // {
        //     "x": 133,
        //     "y": 100,
        //     "width": 134,
        //     "height": 100,
        //     "label": "5"
        // },
        // {
        //     "x": 267,
        //     "y": 100,
        //     "width": 133,
        //     "height": 100,
        //     "label": "6"
        // },
        // {
        //     "x": 0,
        //     "y": 200,
        //     "width": 133,
        //     "height": 100,
        //     "label": "7"
        // },
        // {
        //     "x": 133,
        //     "y": 200,
        //     "width": 134,
        //     "height": 100,
        //     "label": "8"
        // },
        // {
        //     "x": 267,
        //     "y": 200,
        //     "width": 133,
        //     "height": 100,
        //     "label": "9"
        // }
    ] // used for navigation
    aggregationIndicator: AggregationType = { channel: "", attribute: "", operation: "" }// used for aggregation
    aggregationGrids: GridCell[] = [
        // {
        //     "x": 0.5,
        //     "y": 300.5,
        //     "width": 400,
        //     "height": 32.78 + 3,
        //     "label": "1"
        // },
        // {
        //     "x": 0.5 - 28.5 - 3,
        //     "y": 0.5,
        //     "width": 28.56 + 3,
        //     "height": 300,
        //     "label": "2"
        // },
        // {
        //     "x": 418 - 2,
        //     "y": 0,
        //     "width": 48 + 3,
        //     "height": 62,
        //     "label": "3"
        // }
    ] // used for aggregation
    changeColorIndicator = { "isOneStep": true } // used for color change
    highlightIndicator = { "isHighlight": false } // used for highlight
    detailIndicator = { "isDetailShown": false } // used for detail


    // start of deprecated
    status: InteractStatus = InteractStatus.SpeechOff
    interact_now: InteractUnit[] = [];
    interacts: InteractUnit[][] = [];

    // new data structure: all with speech, coords, grids, feedback
    // count: number = 1; // = len(interacts) + 1
    // status: InteractStatus = InteractStatus.SpeechOff
    // interact_now: InteractUnit[] = [];
    // interacts: InteractUnit[][] = [];
    // redoList: InteractUnit[][] = [];// the structure is similar to interacts

    // update_flag = true
    // gTransform = { x: 0, y: 0 } // transform of the current chart
    // xyScales: any = {} // scales of the current chart
    // specification_org: any = {
    //     "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
    //     "description": "A scatter plot with more than 20 points across 3 categories.",
    //     "data": {
    //         "values": [
    //             { "x": 1, "y": 3, "category": "A" },
    //             { "x": 2, "y": 7, "category": "A" },
    //             { "x": 3, "y": 6, "category": "A" },
    //             { "x": 4, "y": 6, "category": "B" },
    //             { "x": 5, "y": 7, "category": "B" },
    //             { "x": 6, "y": 8, "category": "B" },
    //             { "x": 7, "y": 5, "category": "B" },
    //             { "x": 8, "y": 9, "category": "B" },
    //             { "x": 3, "y": 4, "category": "C" },
    //             { "x": 4, "y": 7, "category": "C" },
    //             { "x": 5, "y": 6, "category": "C" },
    //             { "x": 6, "y": 5, "category": "C" },
    //             { "x": 7, "y": 8, "category": "C" },
    //             { "x": 8, "y": 6, "category": "C" },
    //             { "x": 9, "y": 7, "category": "C" }
    //         ]
    //     },
    //     "mark": "point",
    //     "encoding": {
    //         "x": {
    //             "field": "x",
    //             "type": "quantitative",
    //             "axis": { "title": "X Axis" }
    //         },
    //         "y": {
    //             "field": "y",
    //             "type": "quantitative",
    //             "axis": { "title": "Y Axis" }
    //         },
    //         "color": {
    //             "field": "category",
    //             "type": "nominal",
    //             "legend": { "title": "Category" },
    //             "scale": { "scheme": "category10" }
    //         },
    //         "tooltip": [
    //             { "field": "x", "type": "quantitative", "title": "X Value" },
    //             { "field": "y", "type": "quantitative", "title": "Y Value" },
    //             { "field": "category", "type": "nominal", "title": "Category" }
    //         ]
    //     },
    //     "width": 400,
    //     "height": 300
    // }

    speech_now: Message
    speech_list: Message[] = []

    coords_now: XYCoords
    coords_list: XYCoords[] = []
    gridCells_now: GridCell[] = []
    gridCells_list: GridCell[][] = []

    // view: any = null
    specification_now: any = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "description": "A scatter plot with more than 20 points across 3 categories.",
        "data": {
            "values": [
                { "x": 1, "y": 3, "category": "A" },
                { "x": 2, "y": 7, "category": "A" },
                { "x": 3, "y": 6, "category": "A" },
                { "x": 4, "y": 6, "category": "B" },
                { "x": 5, "y": 7, "category": "B" },
                { "x": 6, "y": 8, "category": "B" },
                { "x": 7, "y": 5, "category": "B" },
                { "x": 8, "y": 9, "category": "B" },
                { "x": 3, "y": 4, "category": "C" },
                { "x": 4, "y": 7, "category": "C" },
                { "x": 5, "y": 6, "category": "C" },
                { "x": 6, "y": 5, "category": "C" },
                { "x": 7, "y": 8, "category": "C" },
                { "x": 8, "y": 6, "category": "C" },
                { "x": 9, "y": 7, "category": "C" }
            ]
        },
        "mark": "point",
        "encoding": {
            "x": {
                "field": "x",
                "type": "quantitative",
                "axis": { "title": "X Axis" }
            },
            "y": {
                "field": "y",
                "type": "quantitative",
                "axis": { "title": "Y Axis" }
            },
            "color": {
                "field": "category",
                "type": "nominal",
                "legend": { "title": "Category" },
                "scale": { "scheme": "category10" }
            },
            "tooltip": [
                { "field": "x", "type": "quantitative", "title": "X Value" },
                { "field": "y", "type": "quantitative", "title": "Y Value" },
                { "field": "category", "type": "nominal", "title": "Category" }
            ]
        },
        "width": 400,
        "height": 300
    }
    specification_list: any[] = []

    // bar chart example
    // specification_current: any = {
    //     $schema: "https://vega.github.io/schema/vega-lite/v5.json",
    //     description: "A simple bar chart with Vega-Lite",
    //     data: {
    //         values: [
    //             { category: "A", value: 28 },
    //             { category: "B", value: 55 },
    //             { category: "C", value: 43 },
    //             { category: "D", value: 91 },
    //             { category: "E", value: 81 },
    //             { category: "F", value: 53 },
    //             { category: "G", value: 19 },
    //             { category: "H", value: 87 },
    //         ],
    //     },
    //     mark: "bar",
    //     encoding: {
    //         x: { field: "category", type: "nominal", axis: { title: "Category" } },
    //         y: { field: "value", type: "quantitative", axis: { title: "Value" } },
    //     },
    //     width: 400,
    //     height: 300
    // }   

    // end of deprecated


    // may be deprecated
    // units with the same index
    get interactNow() {
        return this.interactions.filter(unit => unit.index == this.unitNow?.index)
    }

    // make sure chart has relevant encodings
    // FIXME: only deal with x, y and color
    get chartEncodedAttributes() {
        return {
            'x': {
                channel: 'x',
                field: this.specification_org.encoding.x.field,
                type: this.specification_org.encoding.x.type,
                label: '1' // used for aggregation
            },
            "y": {
                channel: 'y',
                field: this.specification_org.encoding.y.field,
                type: this.specification_org.encoding.y.type,
                label: '2' // used for aggregation
            },
            "color": {
                channel: 'color',
                field: this.specification_org.encoding?.color ? this.specification_org.encoding.color.field : "",
                type: this.specification_org.encoding?.color ? this.specification_org.encoding.color.type : "",
                label: '3' // used for aggregation
            },
            "shape": {
                channel: 'shape',
                field: this.specification_org.encoding?.shape ? this.specification_org.encoding.shape.field : "",
                type: this.specification_org.encoding?.shape ? this.specification_org.encoding.shape.type : "",
                label: '4' // used for aggregation
            }
        }
    }

    // used for aggregation: get attrs that can act aggregate
    get aggregateEncoding() {
        let attrs2Agg: EncodingType[] = []
        _.forEach(this.chartEncodedAttributes, function (o, key) {
            if (o.type == "quantitative") attrs2Agg.push(o)
        })
        return attrs2Agg
    }

    // used for change color
    get colorChannel() {
        return {
            channel: 'color',
            hasChannel: this.unitNow?.chartSpec?.encoding?.color ? true : false,
            field: this.unitNow?.chartSpec?.encoding?.color?.field ? this.unitNow.chartSpec.encoding.color.field : "",
            type: this.unitNow?.chartSpec?.encoding?.color?.field ? this.unitNow.chartSpec.encoding.color.type : "",
        }
    }


    // it's not working maybe .selectedDataItem is not observable
    // get selectedItems() {
    //     // Filter units where selectedDataItem is a non-empty array
    //     const selectRelatedUnits = this.interactions.filter(unit => {
    //         if (unit.selectedDataItem != undefined && unit.selectedDataItem.length > 0) return true
    //         else return false
    //     })

    //     let selectedItems: string[] = []// ids of the selected data items
    //     selectRelatedUnits.forEach(unit => selectedItems = _.concat(selectedItems, unit.selectedDataItem))
    //     // get unique values from the list
    //     selectedItems = _.uniq(selectedItems)
    //     console.log("locate items", selectedItems);

    //     // get unique values from the list
    //     return selectedItems
    // }

    // computed    
    // get currentSlide(): SlideData {
    //     try {
    //         if (this.slides.length >= this.currentSlideNo) {
    //             let temp = this.slides[this.currentSlideNo]

    //             // set current slide id
    //             this.currentSlideID = temp.id

    //             // set current titleOutline
    //             // this.setCurrentTitleOutline()

    //             // console.log('get currentSlide', this.currentSlideID);
    //             return temp;
    //         }

    //         else return this.slides?.[0];
    //     } catch (error) {
    //         console.log(error);
    //         return this.slides?.[0];
    //     }
    // }


    // getRecTopicsV2(recType, context) {
    //     // summarize所有cells
    //     // console.log('getRecTopicsV2');

    //     // 构建API数据
    //     const url = URLBase + '/rec_topics_4_context_V2';
    //     console.log('url', url);
    //     const data = JSON.parse(
    //         JSON.stringify({
    //             type: recType,
    //             context: context,
    //         })
    //     );
    //     // console.log('data', data);

    //     try {
    //         axios({
    //             url: url,
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json;charset=utf-8',
    //                 'Access-Control-Allow-Origin': '*'
    //             },
    //             data: data
    //         })
    //             .then(res => {
    //                 let resData = JSON.parse(JSON.stringify(res.data))
    //                 // console.log('res', resData);

    //                 let res2Store: string[] = []
    //                 if (context.length == 0) {
    //                     res2Store = resData
    //                 } else {
    //                     // adjust for recording
    //                     if (this.isRecording == true) {
    //                         res2Store.push('Selecting Features')

    //                         resData = _.filter(resData, o => o.topic != 'Selecting Numeric and Categorical Columns' && o.topic != 'Selecting Features')
    //                     }

    //                     resData.map((item, index) => {
    //                         res2Store.push(item.topic)
    //                     })
    //                 }
    //                 this.outlineRecsV2 = res2Store
    //             })
    //             .catch(err => {
    //                 console.log(err);
    //             });
    //     } catch (error) {
    //         console.log(error);
    //     }
    // }


    // loadFromLocalStorage(nb2SlidesStore) {
    //     if (nb2SlidesStore) {
    //         this.currentSlideNo = nb2SlidesStore.currentSlideNo;

    //         this.cells = nb2SlidesStore.cells;
    //         this.cellsRelation = nb2SlidesStore.cellsRelation;

    //         this.slides = nb2SlidesStore.slides;
    //         this.style = nb2SlidesStore.style;
    //         this.tags = nb2SlidesStore.tags;

    //         // add for new tool
    //         this.outlineStateFromStore = nb2SlidesStore.outlineStateFromStore
    //         this.outlineEditorData = nb2SlidesStore.outlineEditorData
    //         this.convertedBlocks = nb2SlidesStore.convertedBlocks
    //         this.outlinesBeforeBE = nb2SlidesStore.outlinesBeforeBE
    //         // this.currentNaviOutline = nb2SlidesStore.currentNaviOutline
    //         this.allUpdatedBlockIDs = nb2SlidesStore.allUpdatedBlockIDs

    //         this.slidesCouner = nb2SlidesStore.slidesCouner
    //         this.userPreference = nb2SlidesStore.userPreference
    //     }
    // }
}
