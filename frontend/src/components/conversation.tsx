import React, { useEffect, useState, Component, useRef } from 'react';
import { observer } from 'mobx-react';
import * as _ from 'lodash';

import {
    Message,
    InteractStatus,
    SenderType,
    InteractUnit,
    switchChartGrids,
    getXYCoords,
    createThenShowGridsAndLabels,
    selectGrid,
    selectMarkLabels,
    handleSpeechCommand,
    LabelType,
    handleSpeechCommandSV
} from '../util.tsx';
import { MainStore } from '../mainstore';

import { AudioOutlined, UserOutlined } from '@ant-design/icons';
import { Input, Space, Tag, Button, Flex, Alert } from 'antd';
import { updateSpec } from '../llm.ts';
import { toJS } from 'mobx';

// use lucide icons
import { Mic, MicOff, Volume2, MessageCircle } from "lucide-react";
import { SpeechContainerV4, SpeechContainerV5 } from './speech.tsx';

// adjust UI, and hide buttons if required
export const ConversationV5 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const [userInput, setUserInput] = useState("");

    // Automatically stop listening and process the transcript when recognition ends
    useEffect(() => {
        // console.log("handle speech", mainstore.speech);
        // setUserInput(JSON.stringify(mainstore.speech))
        handleUserInput(mainstore.speech)
    }, [mainstore.speech]); // Run this effect when the `listening` state changes

    // act based on user input by typing or speech
    const handleUserInput = (userInput) => {
        if (userInput.trim() === "") return;
        console.log("handleUserInput: ", userInput);

        // 1. create new interact unit
        const userMessage: Message = {
            sender: SenderType.User,
            text: userInput
        };

        const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number
        let interactTemp: InteractUnit = {
            speech: userMessage,
            chartSpec: countTemp == 1 ? _.cloneDeep(mainstore.specification_org) : ""
        }

        let lastUnit = mainstore.interactions.at(-1)
        if (lastUnit != undefined) {// copy last spec
            interactTemp.chartSpec = _.cloneDeep(lastUnit.chartSpec)

            // used for aid recovering
            interactTemp.isAidOn = lastUnit.isAidOn
            interactTemp.labelType = lastUnit.labelType
            interactTemp.overlayGrids = lastUnit.overlayGrids
            interactTemp.gridsToDataItems = lastUnit.gridsToDataItems
            // interactTemp.overlayCoords = lastUnit.overlayCoords
        }

        // 2. put interact unit into store
        mainstore.interactions.push(interactTemp)

        // 3. act based on user input: LLM to map speech to actions, distill params, and execute
        // createActions()
        // handleSpeechCommand({
        //     transcript: userInput,
        //     mainstore: mainstore
        // });

        // speechviz
        handleSpeechCommandSV({
            transcript: userInput,
            mainstore: mainstore
        })

        // 4. Clear the input
        setUserInput("");

        // console.log('handleUserInput mainstore', toJS(mainstore));
    };

    // Automatically scroll to the last element when items change
    const containerRef = useRef<HTMLDivElement>(null); // Reference to the container
    useEffect(() => {
        if (containerRef.current && mainstore.interactions.length > 0) {
            const lastChild = containerRef.current.lastElementChild;
            if (lastChild) {
                lastChild.scrollIntoView({ behavior: "smooth" });
            }
            // console.log("lastChild", lastChild);
        }
    }, [mainstore.interactions.length]); // Run this effect whenever `interactions` are updated

    const UnitsDiv = (units: InteractUnit[]) => {
        // return <div key={outIndex} style={{ width: "95%", borderBottom: "2px dashed #f2f2f2", margin: 6 }}>
        // no border distinguis tasks that have several units
        return <div ref={containerRef} style={{ maxHeight: 375, width: "95%", margin: 6, padding: 6, overflowY: "auto" }}>
            {units.map((unit, index) => {
                return unitDiv(unit, index + "")
            })}
        </div>
    }

    const unitDiv = (unit: InteractUnit, index: string) => {
        let isLastUnit = index == (mainstore.interactions.length - 1) + ""

        return (
            <div key={index} style={{
                borderLeft: isLastUnit ? "3px solid gray" : "",
                // backgroundColor: isLastUnit ? "red" : ""
            }
            }>
                <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                    <div style={{
                        maxWidth: "85%",
                        wordWrap: "break-word",
                        overflowWrap: "break-word",
                        textAlign: "right",
                        // backgroundColor: "#8585e0",// purple
                        backgroundColor: "#dcf8c6", // Light green
                        borderRadius: 6,
                        padding: 6,
                        margin: 6
                    }}>{unit.speech.text}</div>
                </div>
                {
                    unit.feedbackSpeech ?
                        <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                            <div style={{
                                maxWidth: "85%",
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                textAlign: "left",
                                // backgroundColor: "#f7f7f7", // light gray
                                backgroundColor: "#fff",
                                borderRadius: 6,
                                padding: 6,
                                margin: 6
                            }}>{unit.feedbackSpeech.text}</div>
                        </div> : ""
                }
            </div >
        )
    }

    const render = () => {
        const { TextArea } = Input;

        return (
            <Flex vertical justify='space-between' style={{ maxHeight: 420, border: "1.5px solid #b3b3b3", borderRadius: 8 }}>
                <Flex vertical gap="small" align='center'>
                    {
                        mainstore.interactions.length > 0 ?
                            UnitsDiv(mainstore.interactions)
                            :
                            <Flex gap="small" align='center' style={{ height: 300 }}>
                                <Alert
                                    message="No interaction history"
                                    type='info'
                                    showIcon
                                    style={{ height: 60 }}
                                />
                            </Flex>
                    }
                </Flex>
                <Flex justify='center' style={{ width: "96%", padding: 5 }}>
                    <SpeechContainerV5 mainstore={mainstore} />
                </Flex>
                {
                    mainstore.speechIndicator.showTypeButton ?
                        <Flex vertical gap="small" align='center' style={{ margin: 6 }}>
                            <Flex gap={5} align='center' style={{ width: "100%", margin: 6 }}>
                                {/* <AudioOutlined /> */}
                                {/* <MessageCircle size={22} color="gray" /> */}
                                {/* <TextArea
                                    placeholder="Type to interact"
                                    value={userInput}
                                    onChange={e => setUserInput(e.target.value)}
                                    autoSize
                                    style={{ width: "92%" }}
                                    onPressEnter={() => handleUserInput(userInput)}
                                /> */}
                                <Input
                                    placeholder="Type to interact"
                                    value={userInput}
                                    onChange={e => setUserInput(e.target.value)}
                                    style={{ width: "92%" }}
                                    onPressEnter={() => handleUserInput(userInput)}
                                />
                                <Button onClick={() => handleUserInput(userInput)}>Type</Button>
                            </Flex>
                        </Flex> :
                        ""
                }
            </Flex >
        );
    }

    return render();
});

// used for speech to actions
export const ConversationV4 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const [userInput, setUserInput] = useState("");

    // Automatically stop listening and process the transcript when recognition ends
    useEffect(() => {
        // console.log("handle speech", mainstore.speech);
        // setUserInput(JSON.stringify(mainstore.speech))
        handleUserInput(mainstore.speech)
    }, [mainstore.speech]); // Run this effect when the `listening` state changes

    // act based on user input by typing or speech
    const handleUserInput = (userInput) => {
        if (userInput.trim() === "") return;
        console.log("handleUserInput: ", userInput);

        // 1. create new interact unit
        const userMessage: Message = {
            sender: SenderType.User,
            text: userInput
        };

        const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number
        let interactTemp: InteractUnit = {
            speech: userMessage,
            chartSpec: countTemp == 1 ? _.cloneDeep(mainstore.specification_org) : ""
        }

        let lastUnit = mainstore.interactions.at(-1)
        if (lastUnit != undefined) {// copy last spec
            interactTemp.chartSpec = _.cloneDeep(lastUnit.chartSpec)
            interactTemp.labelType = lastUnit.labelType
            interactTemp.overlayGrids = lastUnit.overlayGrids
            interactTemp.overlayCoords = lastUnit.overlayCoords
        }

        // 2. put interact unit into store
        mainstore.interactions.push(interactTemp)

        // 3. act based on user input: LLM to map speech to actions, distill params, and execute
        // createActions()
        handleSpeechCommand({
            transcript: userInput,
            mainstore: mainstore
        });

        // 4. Clear the input
        setUserInput("");

        // console.log('handleUserInput mainstore', toJS(mainstore));
    };

    // suitable when units are organizing into task
    const UnitsDiv = (units: InteractUnit[], outIndex) => {
        return <div key={outIndex} style={{ width: "95%", borderBottom: "2px dashed #f2f2f2", margin: 6 }}>
            {units.map((unit, inIndex) => {
                return unitDiv(unit, outIndex + "_" + inIndex)
            })}
        </div>
    }

    const unitDiv = (unit: InteractUnit, index: string) => {
        if (unit.feedbackSpeech) {
            return (
                <div key={index}>
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                        <div style={{
                            maxWidth: "85%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "left",
                            backgroundColor: "#8585e0",
                            borderRadius: 6,
                            padding: 6,
                            margin: 6
                        }}>{unit.speech.text}</div>
                    </div>
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                        <div style={{
                            maxWidth: "85%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "left",
                            backgroundColor: "#f7f7f7",
                            borderRadius: 6,
                            padding: 6,
                            margin: 6
                        }}>{unit.feedbackSpeech.text}</div>
                    </div>
                </div>
            )
        } else {
            return (
                <div key={index}>
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                        <div style={{
                            maxWidth: "85%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "left",
                            backgroundColor: "#8585e0",
                            borderRadius: 6,
                            padding: 6,
                            margin: 6
                        }}>{unit.speech.text}</div>
                    </div>
                </div>
            )
        }
    }

    const render = () => {
        const { TextArea } = Input;

        return (
            <div style={{ border: "1.5px solid #b3b3b3", borderRadius: 6 }}>
                <Flex vertical gap="small" align='center'>
                    {
                        mainstore.interactions.length > 0 ?
                            UnitsDiv(mainstore.interactions, 1)
                            : null
                    }
                </Flex>
                <Flex vertical gap="small" align='center' style={{ margin: 6 }}>
                    <Flex gap={5} align='center' style={{ width: "100%" }}>
                        <AudioOutlined />
                        <TextArea
                            placeholder="Speech to interact"
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            autoSize
                            style={{ width: "92%" }}
                        />
                    </Flex>
                    <Flex gap="small" align='center'>
                        <Button onClick={() => handleUserInput(userInput)}>Speak</Button>
                        <Button onClick={async () => {
                            // take the current typed in as command for LLM 
                            handleUserInput(userInput)

                            // call LLM to handle
                            // FIXME: to be fixed for new data structure, 
                            // new interact is not create

                            // new data
                            const interactUnitNow = mainstore.interact_now.at(-1)
                            if (interactUnitNow) {
                                let command = toJS(interactUnitNow.speech.text)
                                let currentSpec = toJS(interactUnitNow.chartSpec)

                                let result = await updateSpec(command, currentSpec)
                                let updatedSpec = result['spec']
                                console.log("result", result);

                                interactUnitNow.chartSpec = updatedSpec
                                mainstore.update_flag = !mainstore.update_flag
                            } else {
                                console.log('interactUnitNow is null.');
                            }
                        }}>LLM Update Spec</Button>
                    </Flex>
                </Flex>
            </div >
        );
    }

    return render();
});

// used for NL to actions
export const ConversationV3 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const [userInput, setUserInput] = useState("");

    // FIXME: interpret user input
    const checkInteractType = () => {
        if (userInput == "1") {
            return InteractStatus.Start
        } else if (userInput == "2") {
            return InteractStatus.Ongoing
        } else if (userInput == "3") {
            return InteractStatus.End
        } else {
            return InteractStatus.Direct
        }
    }

    const createActions = () => {
        if (userInput == "1") {
            // 1. hide chart grids
            switchChartGrids(false, mainstore)
            // 2. generate grids
            const xyCoords = getXYCoords()
            createThenShowGridsAndLabels(xyCoords, mainstore)

            // if sepc is changed, re-render the chart
            mainstore.update_flag = !mainstore.update_flag
        } else if (userInput == "2") {
            // 3. select grids: 
            // highlight selected grids
            // hide grids
            // zoom in
            // and draw mark labels
            const gridCells = mainstore.interact_now.at(-1)?.overlayGrids
            if (gridCells) {
                selectGrid({
                    labels: ["4"],
                    gridCells: gridCells,
                    mainstore: mainstore
                })
            } else {
                console.log("gridCells is null.");
            }

            // // if sepc is changed, re-render the chart
            // mainstore.update_flag = !mainstore.update_flag
        } else if (userInput == "3") {
            // 4. select labels:
            // hide mark labels
            // zoom back
            // highlight selected
            // show chart grid
            selectMarkLabels(['2', '3'], mainstore)

            // if sepc is changed, re-render the chart
            mainstore.update_flag = !mainstore.update_flag
        } else {
            // if the command is not supported, inform the user
            const systemResponse: Message = {
                sender: SenderType.System,
                text: `"${userInput}" is not supported.`,
            };

            const interactUnitNow = mainstore.interact_now.at(-1)
            if (interactUnitNow) {
                interactUnitNow.feedbackSpeech = systemResponse
            }
        }
    }

    const actOnCommand = () => {
        // map to task, and distill params if applicatble

        // call actions

    }

    const handleUserInput = () => {
        if (userInput.trim() === "") return;

        // 1. create new interact unit
        const userMessage: Message = {
            sender: SenderType.User,
            text: userInput
        };

        const countTemp = +toJS(mainstore.count) // convert mobx to JSON then to number
        let interactTemp: InteractUnit = {
            speech: userMessage,
            chartSpec: countTemp == 1 ? _.cloneDeep(mainstore.specification_org) : ""
        }

        let lastUnit = mainstore.interactions.at(-1)
        if (lastUnit != undefined) {// copy last spec
            interactTemp.chartSpec = _.cloneDeep(lastUnit.chartSpec)
            interactTemp.overlayGrids = lastUnit.overlayGrids
            interactTemp.overlayCoords = lastUnit.overlayCoords
        }

        // 2. put interact unit into store
        mainstore.interactions.push(interactTemp)

        // 3. act based on user input
        // FIXME: LLM to map speech to actions, distill params, and execute
        // createActions()
        // actOnCommand()
        handleSpeechCommand({
            transcript: userInput,
            mainstore: mainstore
        });

        // 4. Clear the input
        setUserInput("");

        // console.log('handleUserInput mainstore', toJS(mainstore));
    };

    const UnitsDiv = (units: InteractUnit[], outIndex) => {
        return <div key={outIndex} style={{ width: "95%", borderBottom: "2px dashed #f2f2f2", margin: 6 }}>
            {units.map((unit, inIndex) => {
                return unitDiv(unit, outIndex + "_" + inIndex)
            })}
        </div>
    }

    const unitDiv = (unit: InteractUnit, index: string) => {
        if (unit.feedbackSpeech) {
            return (
                <div key={index}>
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                        <div style={{
                            maxWidth: "85%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "left",
                            backgroundColor: "#8585e0",
                            borderRadius: 6,
                            padding: 6,
                            margin: 6
                        }}>{unit.speech.text}</div>
                    </div>
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                        <div style={{
                            maxWidth: "85%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "left",
                            backgroundColor: "#f7f7f7",
                            borderRadius: 6,
                            padding: 6,
                            margin: 6
                        }}>{unit.feedbackSpeech.text}</div>
                    </div>
                </div>
            )
        } else {
            return (
                <div key={index}>
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                        <div style={{
                            maxWidth: "85%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "left",
                            backgroundColor: "#8585e0",
                            borderRadius: 6,
                            padding: 6,
                            margin: 6
                        }}>{unit.speech.text}</div>
                    </div>
                </div>
            )
        }
    }

    const render = () => {
        const { TextArea } = Input;

        return (
            <div style={{ border: "1.5px solid #b3b3b3", borderRadius: 6 }}>
                <Flex vertical gap="small" align='center'>
                    {
                        mainstore.interactions.length > 0 ?
                            UnitsDiv(mainstore.interactions, 1)
                            : null
                    }
                </Flex>
                <Flex vertical gap="small" align='center' style={{ margin: 6 }}>
                    <Flex gap={5} align='center' style={{ width: "100%" }}>
                        <AudioOutlined />
                        <TextArea
                            placeholder="Speech to interact"
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            autoSize
                            style={{ width: "92%" }}
                        />
                    </Flex>
                    <Flex gap="small" align='center'>
                        <Button onClick={handleUserInput}>Send</Button>
                        <Button onClick={async () => {
                            // take the current typed in as command for LLM 
                            handleUserInput()

                            // call LLM to handle
                            // FIXME: to be fixed for new data structure, 
                            // new interact is not create

                            // new data
                            const interactUnitNow = mainstore.interact_now.at(-1)
                            if (interactUnitNow) {
                                let command = toJS(interactUnitNow.speech.text)
                                let currentSpec = toJS(interactUnitNow.chartSpec)

                                let result = await updateSpec(command, currentSpec)
                                let updatedSpec = result['spec']
                                console.log("result", result);

                                interactUnitNow.chartSpec = updatedSpec
                                mainstore.update_flag = !mainstore.update_flag
                            } else {
                                console.log('interactUnitNow is null.');
                            }
                        }}>Send to AI</Button>
                    </Flex>
                </Flex>
            </div >
        );
    }

    return render();
});

// used for testing 1,2,3 to actions
export const ConversationV2 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const [userInput, setUserInput] = useState("");

    // FIXME: interpret user input
    const checkInteractType = () => {
        if (userInput == "1") {
            return InteractStatus.Start
        } else if (userInput == "2") {
            return InteractStatus.Ongoing
        } else if (userInput == "3") {
            return InteractStatus.End
        } else {
            return InteractStatus.Direct
        }
    }

    const createActions = () => {
        if (userInput == "1") {
            // 1. hide chart grids
            switchChartGrids(false, mainstore)
            // 2. generate grids
            const xyCoords = getXYCoords()
            createThenShowGridsAndLabels(xyCoords, mainstore)

            // if sepc is changed, re-render the chart
            mainstore.update_flag = !mainstore.update_flag
        } else if (userInput == "2") {
            // 3. select grids: 
            // highlight selected grids
            // hide grids
            // zoom in
            // and draw mark labels
            const gridCells = mainstore.interact_now.at(-1)?.overlayGrids
            if (gridCells) {
                selectGrid({
                    labels: ["4"],
                    gridCells: gridCells,
                    mainstore: mainstore
                })
            } else {
                console.log("gridCells is null.");
            }

            // // if sepc is changed, re-render the chart
            // mainstore.update_flag = !mainstore.update_flag
        } else if (userInput == "3") {
            // 4. select labels:
            // hide mark labels
            // zoom back
            // highlight selected
            // show chart grid
            selectMarkLabels(['2', '3'], mainstore)

            // if sepc is changed, re-render the chart
            mainstore.update_flag = !mainstore.update_flag
        } else {
            // if the command is not supported, inform the user
            const systemResponse: Message = {
                sender: SenderType.System,
                text: `"${userInput}" is not supported.`,
            };

            const interactUnitNow = mainstore.interact_now.at(-1)
            if (interactUnitNow) {
                interactUnitNow.feedbackSpeech = systemResponse
            }
        }
    }

    const handleUserInput = () => {
        if (userInput.trim() === "") return;

        // check the status of the interaction
        mainstore.status = checkInteractType()

        // act based on status and user input
        // 1. create new interact unit
        const userMessage: Message = {
            sender: SenderType.User,
            text: userInput
        };
        const countTemp = +toJS(mainstore.count)

        // copy last unit and replace
        let interactTemp: InteractUnit
        if (mainstore.interact_now.length > 0) {// in the middle of an interaction
            interactTemp = _.cloneDeep(mainstore.interact_now?.at(-1))

            interactTemp.speech = userMessage
            interactTemp.index = countTemp
            interactTemp.feedbackSpeech = undefined
        } else if (mainstore.interacts.length > 0) {// new interaction
            interactTemp = _.cloneDeep(mainstore.interacts?.at(-1)?.at(-1))

            interactTemp.speech = userMessage
            interactTemp.index = countTemp
            interactTemp.feedbackSpeech = undefined
        } else {// init the interaction
            interactTemp = {
                speech: userMessage,
                index: countTemp,
                chartSpec: _.cloneDeep(mainstore.specification_org)
            }
        }
        // mainstore.speech_now = userMessage
        // mainstore.speech_list = [...mainstore.speech_list, userMessage]

        // 2. update store based on the status
        if (_.includes([
            InteractStatus.Ongoing,
            InteractStatus.End], mainstore.status)) {
            // add units into the current interact
            mainstore.interact_now.push(interactTemp)
        } else if (_.includes([
            InteractStatus.Start,
            InteractStatus.Direct], mainstore.status)) {
            // new interaction: store last interaction
            if (countTemp > 1)
                mainstore.interacts.push(mainstore.interact_now)

            // update the current interaction
            mainstore.interact_now = [interactTemp]
            mainstore.count += 1
        }

        // 3. act based on user input
        // FIXME: LLM to map speech to actions, distill params, and execute
        createActions()

        // 4. Clear the input
        setUserInput("");

        console.log('handleUserInput', toJS(mainstore));
    };

    const UnitsDiv = (units: InteractUnit[], outIndex) => {
        return <div key={outIndex} style={{ width: "95%", borderBottom: "2px dashed #f2f2f2", margin: 6 }}>
            {units.map((unit, inIndex) => {
                return unitDiv(unit, outIndex + "_" + inIndex)
            })}
        </div>
    }

    const unitDiv = (unit: InteractUnit, index: string) => {
        if (unit.feedbackSpeech) {
            return (
                <div key={index}>
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                        <div style={{
                            maxWidth: "85%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "left",
                            backgroundColor: "#8585e0",
                            borderRadius: 6,
                            padding: 6,
                            margin: 6
                        }}>{unit.speech.text}</div>
                    </div>
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                        <div style={{
                            maxWidth: "85%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "left",
                            backgroundColor: "#f7f7f7",
                            borderRadius: 6,
                            padding: 6,
                            margin: 6
                        }}>{unit.feedbackSpeech.text}</div>
                    </div>
                </div>
            )
        } else {
            return (
                <div key={index}>
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                        <div style={{
                            maxWidth: "85%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "left",
                            backgroundColor: "#8585e0",
                            borderRadius: 6,
                            padding: 6,
                            margin: 6
                        }}>{unit.speech.text}</div>
                    </div>
                </div>
            )
        }
    }

    const messageDiv = (message: Message, index: string) => {
        if (message.sender == SenderType.User) {
            return (
                <div key={index} style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                    <div style={{
                        maxWidth: "85%",
                        wordWrap: "break-word",
                        overflowWrap: "break-word",
                        textAlign: "left",
                        backgroundColor: "#8585e0",
                        borderRadius: 6,
                        padding: 6,
                        margin: 6
                    }}>{message.text}</div>
                </div>
            )
        } else {
            return (
                <div key={index} style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                    <div style={{
                        maxWidth: "85%",
                        wordWrap: "break-word",
                        overflowWrap: "break-word",
                        textAlign: "left",
                        backgroundColor: "#f7f7f7",
                        borderRadius: 6,
                        padding: 6,
                        margin: 6
                    }}>{message.text}</div>
                </div>
            )
        }
    }

    const render = () => {
        const { TextArea } = Input;

        return (
            <div style={{ border: "1.5px solid #b3b3b3", borderRadius: 6 }}>
                {/* <div>
                    {mainstore.speech_list.map((message, index) => {
                        return messageDiv(message, index + "")
                    })}
                </div> */}
                {/* <div> */}
                <Flex vertical gap="small" align='center'>
                    {
                        mainstore.interacts.length > 0 ?
                            mainstore.interacts.map((units, index) => {
                                return UnitsDiv(units, index)
                            })
                            : null
                    }
                    {
                        mainstore.interact_now.length > 0 ?
                            UnitsDiv(mainstore.interact_now, mainstore.count)
                            : null
                    }
                </Flex>
                {/* </div> */}
                <Flex vertical gap="small" align='center' style={{ margin: 6 }}>
                    <Flex gap={5} align='center' style={{ width: "100%" }}>
                        <AudioOutlined />
                        <TextArea
                            placeholder="Speech to interact"
                            value={userInput}
                            onChange={e => setUserInput(e.target.value)}
                            autoSize
                            style={{ width: "92%" }}
                        />
                    </Flex>
                    <Flex gap="small" align='center'>
                        <Button onClick={handleUserInput}>Send</Button>
                        <Button onClick={async () => {
                            // take the current typed in as command for LLM 
                            handleUserInput()

                            // call LLM to handle
                            // FIXME: to be fixed for new data structure, 
                            // new interact is not create

                            // new data
                            const interactUnitNow = mainstore.interact_now.at(-1)
                            if (interactUnitNow) {
                                let command = toJS(interactUnitNow.speech.text)
                                let currentSpec = toJS(interactUnitNow.chartSpec)

                                let result = await updateSpec(command, currentSpec)
                                let updatedSpec = result['spec']
                                console.log("result", result);

                                interactUnitNow.chartSpec = updatedSpec
                                mainstore.update_flag = !mainstore.update_flag
                            } else {
                                console.log('interactUnitNow is null.');
                            }
                        }}>Send to AI</Button>
                    </Flex>
                </Flex>
            </div >
        );
    }

    return render();
});

export const Conversation = observer(({ mainstore }: { mainstore: MainStore }) => {
    const [userInput, setUserInput] = useState("");

    const handleUserInput = () => {
        if (userInput.trim() === "") return;

        // update tool status
        mainstore.status = InteractStatus.SpeechOn

        // Add the user message
        const userMessage: Message = { sender: SenderType.User, text: userInput };
        mainstore.speech_now = userMessage
        mainstore.speech_list = [...mainstore.speech_list, userMessage]

        // Add the system response
        const systemResponse: Message = {
            sender: SenderType.System,
            text: `You said: "${userInput}"`,
        };
        setTimeout(() => {
            mainstore.speech_list.push(systemResponse)
        }, 500);

        // Clear the input
        setUserInput("");
    };

    const messageDiv = (message: Message, index: number) => {
        if (message.sender == SenderType.User) {
            return (
                <div key={index} style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                    <div style={{
                        maxWidth: "85%",
                        wordWrap: "break-word",
                        overflowWrap: "break-word",
                        textAlign: "left",
                        backgroundColor: "#8585e0",
                        borderRadius: 6,
                        padding: 6,
                        margin: 6
                    }}>{message.text}</div>
                </div>
            )
        } else {
            return (
                <div key={index} style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                    <div style={{
                        maxWidth: "85%",
                        wordWrap: "break-word",
                        overflowWrap: "break-word",
                        textAlign: "left",
                        backgroundColor: "#f7f7f7",
                        borderRadius: 6,
                        padding: 6,
                        margin: 6
                    }}>{message.text}</div>
                </div>
            )
        }
    }

    const render = () => {
        const { TextArea } = Input;

        return (
            <div style={{ border: "1.5px solid #b3b3b3", borderRadius: 6 }}>
                <div>
                    {mainstore.speech_list.map((message, index) => {
                        return messageDiv(message, index)
                    })}
                </div>
                <Flex gap="small" style={{ margin: 6 }}>
                    {/* <AudioOutlined /> */}
                    <TextArea
                        placeholder="Speech to interact"
                        value={userInput}
                        onChange={e => setUserInput(e.target.value)}
                        autoSize
                        style={{ width: "85%" }}
                    />
                    <Button onClick={handleUserInput}>Send</Button>
                </Flex>
            </div >
        );
    }

    return render();
});

const ConversationV0 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const [userInput, setUserInput] = useState("");

    const handleUserInput = () => {
        if (userInput.trim() === "") return;

        // update tool status
        mainstore.status = InteractStatus.SpeechOn

        // Add the user message
        const userMessage: Message = { sender: SenderType.User, text: userInput };
        mainstore.speech_now = userMessage
        mainstore.speech_list = [...mainstore.speech_list, userMessage]

        // Add the system response
        const systemResponse: Message = {
            sender: SenderType.System,
            text: `You said: "${userInput}"`,
        };
        setTimeout(() => {
            mainstore.speech_list.push(systemResponse)
        }, 500);

        // Clear the input
        setUserInput("");
    };

    const messageDiv = (message: Message) => {
        // const { TextArea } = Input;

        if (message.sender == SenderType.User || true) {
            return (
                <div style={{ position: 'absolute', right: 0, width: "80%" }}>
                    <strong>
                        {message.sender}:
                    </strong>
                    {/* <TextArea
                        value={message.text}
                        autoSize
                        disabled
                        style={{ width: "85%", backgroundColor: 'lightgray' }}
                    /> */}
                    <div style={{ backgroundColor: "pink" }}>{message.text}</div>
                </div>
            )
        }
    }

    const render = () => {
        const { TextArea } = Input;

        return (
            <div className="max-w-md mx-auto p-4 bg-white shadow-md rounded-md border border-gray-300">
                <div className="h-80 overflow-y-auto space-y-3 mb-4">
                    {mainstore.speech_list.map((message, index) => (
                        <div
                            key={index}
                            className={`flex ${message.sender === SenderType.User ? "justify-end" : "justify-start"
                                }`}
                        >
                            {/* <strong>
                                {message.sender === "User" ? "User" : "System"}:
                            </strong>{" "} */}
                            <div
                                className={`max-w-xs p-3 rounded-lg ${message.sender === SenderType.User
                                    ? "bg-blue-500 text-white"
                                    : "bg-gray-200 text-gray-800"
                                    }`}
                            >
                                {message.text}
                            </div>
                        </div>
                    ))}
                </div>
                {/* <div style={{ width: "100%" }}>
                    {mainstore.speech_list.map((message, index) => {
                        return messageDiv(message)
                    })}
                </div> */}
                <div className="flex items-center space-x-2">
                    <AudioOutlined />
                    <TextArea
                        placeholder="Speech to interact"
                        value={userInput}
                        onChange={e => setUserInput(e.target.value)}
                        autoSize
                        style={{ width: "85%" }}
                    />
                    <Button onClick={handleUserInput}>Send</Button>
                </div>
            </div>
        );
    }

    return render();
});

// export default Conversation;