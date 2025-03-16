import React, { useEffect, useState, Component, useRef } from 'react';
import { observer } from 'mobx-react';
import * as _ from 'lodash';

import {
    APIState,
    Cell,
    InteractStatus,
    Message,
    SenderType
} from '../util.tsx';
import { MainStore } from '../mainstore';

import { AudioOutlined, UserOutlined } from '@ant-design/icons';
import { Input, Space, Tag, Button, Flex } from 'antd';
import { updateSpec } from '../llm.ts';
import { toJS } from 'mobx';

// speech to text package
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
// use lucide icons
import { Mic, MicOff, Volume2 } from "lucide-react";

export const ControlPanel = observer(({ mainstore }: { mainstore: MainStore }) => {
    const showButtons = () => {
        if (mainstore.speechIndicator.showSpeechControlButtons) {
            return (
                <Flex gap={10} justify='flex-start' align='center' style={{ padding: 5 }}>
                    <Button size='small' onClick={() => mainstore.speechIndicator.startListening = true}>Start Listening</Button>
                    <Button size='small' onClick={() => mainstore.speechIndicator.setToSleep = true} >Set to Sleep</Button>
                    <Button size='small' onClick={() => mainstore.speechIndicator.startListening = false}>Stop Listening</Button>
                    <span>Restart after: {mainstore.speechIndicator.commandLimitNum - mainstore.speechIndicator.restartCount}</span>
                </Flex>
            )
        }
    }

    const render = () => {
        return (
            <Flex vertical justify='flex-start' align='flex-start' style={{ width: "100%", padding: 5 }}>
                {showButtons()}
            </Flex>
        );
    };

    return render();
})