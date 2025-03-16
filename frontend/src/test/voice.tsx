import React, { useEffect, useRef, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

// testing components
function SpeechAssistant() {
    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition,
    } = useSpeechRecognition();

    const [count, setCount] = useState(0); // State to track if the assistant is awake
    const [isAwake, setIsAwake] = useState(false); // State to track if the assistant is awake
    const silenceTimeoutRef = useRef<number | null>(null); // Ref to store the silence timeout
    const commandTimeoutRef = useRef<number | null>(null); // Ref to store the silence timeout

    // Handle wake word detection
    useEffect(() => {
        if (!isAwake && transcript.toLowerCase().includes("hi speech")) {
            console.log("Wake word detected: hi speech");
            setIsAwake(true); // Wake up the assistant
            resetTranscript(); // Reset transcript after wake word is detected

            SpeechRecognition.stopListening();
            // Restart with the new mode
            // setTimeout(() => { SpeechRecognition.startListening({ continuous: false }) }, 50);
        }
    }, [transcript, isAwake]);

    // Handle silence detection
    useEffect(() => {
        if (count > 0 && isAwake == false)
            setCount(0)

        // if (isAwake) {
        //     // Reset the silence timeout whenever there's activity (listening)
        //     resetSilenceTimeout();
        // }

        // return () => {
        //     clearSilenceTimeout(); // Clean up the timeout
        // };
    }, [isAwake]);

    // Automatically stop listening and process the transcript when recognition ends
    useEffect(() => {
        if (isAwake && !listening) {
            // console.log("Speech recognition session ended.");
            console.log("Final transcript:", transcript.trim() == "" ? "null" : transcript.trim());
            if (transcript.trim() != "") {
                handleCommand(transcript.trim())
                resetTranscript(); // Clear any previous transcript
                // resetSilenceTimeout()
            }
        }

        if (isAwake && !listening) {
            // Restart with the new mode
            // if (commandTimeoutRef.current == null) {
                commandTimeoutRef.current = window.setTimeout(() => {
                    setCount((pre) => pre + 1)
                    SpeechRecognition.startListening({ continuous: false })
                }, 50);
            // }
        }

        if (count > 10) {
            stopListening()
        }
    }, [listening]); // Run this effect when the `listening` state changes

    // // Process commands one by one
    // useEffect(() => {
    //     if (isAwake && listening && transcript) {
    //         console.log("Processing command:", transcript);
    //         handleCommand(transcript.trim()); // Process the command
    //         resetTranscript(); // Clear the transcript for the next command
    //         // startListening(); // Restart listening for the next command

    //         resetSilenceTimeout();
    //     }
    // }, [isAwake, listening, transcript]);

    const resetSilenceTimeout = () => {
        // Clear any existing timeout
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
        }

        // Set a new timeout for 3 seconds
        silenceTimeoutRef.current = window.setTimeout(() => {
            console.log("Silence detected for 10 seconds. Stopping listening...");
            stopListening(); // Stop listening if silence is detected
            alert("time out")
        }, 5000); // 3000ms = 3 seconds
    };

    const clearSilenceTimeout = () => {
        if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
        }
    };

    // Handle commands
    const handleCommand = (command: string) => {
        const lowerCaseCommand = command.toLowerCase();

        if (lowerCaseCommand.includes("select")) {
            console.log("Selecting data...");
        } else if (lowerCaseCommand.includes("filter")) {
            console.log("Filtering data...");
        } else if (lowerCaseCommand.includes("zoom")) {
            console.log("Zooming in...");
        } else if (lowerCaseCommand.includes("sort")) {
            console.log("Sorting data...");
        } else {
            console.log("Command not recognized.");
        }
    };

    // Start listening
    const startListening = () => {
        SpeechRecognition.startListening({ continuous: true }); // Start in continuous mode
    };

    // Stop listening
    const stopListening = () => {
        // clearSilenceTimeout()
        if (commandTimeoutRef.current) {
            clearTimeout(commandTimeoutRef.current)
            commandTimeoutRef.current = null
        }

        SpeechRecognition.stopListening();
        // Restart with the new mode
        setTimeout(() => { SpeechRecognition.startListening({ continuous: true }) }, 50);

        setIsAwake(false); // Put the assistant back to sleep
        // clearSilenceTimeout(); // Clear the silence timeout
        console.log("Assistant is now asleep.");
    };

    if (!browserSupportsSpeechRecognition) {
        return <p>Your browser does not support speech recognition.</p>;
    }

    return (
        <div>
            <h1>Speech Assistant</h1>
            <p>Restart count: {count}</p>
            <p>Status: {isAwake ? "Awake" : "Sleeping"}</p>
            <p>Listening: {listening ? "Yes" : "No"}</p>
            <p>Transcript: {transcript || "No command yet"}</p>
            {!isAwake && (
                <p>Say "Hi Speech" to wake up the assistant.</p>
            )}
            <button onClick={startListening} disabled={listening || isAwake}>
                Start Listening
            </button>
            <button onClick={stopListening} disabled={!listening && !isAwake}>
                Stop Listening
            </button>
        </div>
    );
}

export default SpeechAssistant;