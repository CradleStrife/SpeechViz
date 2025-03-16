import React, { useEffect, useState, Component } from 'react';
import { observer } from 'mobx-react';
import { Button, Space } from 'antd';
import * as _ from 'lodash';

import {
    Cell
} from '../util';
import { MainStore } from '../mainstore';
import { SpeechContainer } from './speech.tsx';
import { ChartContainer, ChartContainerV2, ChartContainerV3, ChartContainerV4, ChartContainerV5 } from './chart.tsx'
import { FeedbackContainer, FeedbackContainerV2 } from './feedback.tsx';
import { ControlPanel } from './control.tsx';

// import { NB2SlidesStore } from './store/nb2slides';
// import { OutlineAndSlidesContainner } from './slide-control-v2';
// import dataRecord from './data/outline_ff_adjust';

/**
 * the main widget
 */
const MainComp = observer(({ mainstore }: { mainstore: MainStore }) => {
    const render = () => {
        return (
            <div className="main-container">
                <div className="first-row">
                    {/* <div className="speech-panel">speech-panel</div> */}
                    {/* <SpeechContainer mainstore={mainstore} /> */}
                    <ControlPanel mainstore={mainstore} />
                </div>
                <div className="second-row">
                    {/* <div className="feedback-panle">feedback-panle</div> */}
                    {/* <div className="chart-panel">chart-panel</div> */}
                    {/* <FeedbackContainer mainstore={mainstore} /> */}
                    <FeedbackContainerV2 mainstore={mainstore} />
                    {/* <ChartContainer mainstore={mainstore} /> */}
                    {/* <ChartContainerV2 mainstore={mainstore} /> */}
                    {/* <ChartContainerV3 mainstore={mainstore} /> */}
                    {/* <ChartContainerV4 mainstore={mainstore} /> */}
                    <ChartContainerV5 mainstore={mainstore} />
                </div>

                {/* test component render with mobx state management */}
                {/* <div className="helloworld">
                    <Space>
                        <span>Hello React! Count from {mainstore.count}.</span>
                        <Button
                            onClick={() => mainstore.count += 1}
                        >
                            Count ++
                        </Button>
                    </Space>
                </div> */}
            </div>
        );
    };

    return render();
});

export default MainComp;
