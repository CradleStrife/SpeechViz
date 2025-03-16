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
// 在文件顶部添加类型声明
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
    SpeechGrammarList?: any;
    webkitSpeechGrammarList?: any;
    recognition?: any;
  }
}






//LAI YI 3.15 2.完成语音识别bug后，开始实现基于静默时间的监听机制
export const SpeechContainerV5 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const {
        transcript,
        listening,
        resetTranscript,
    } = useSpeechRecognition();

    // 使用静默时间而不是命令计数限制
    const silenceDuration = mainstore.speechIndicator.silenceDuration;
    // 保留组件内本地状态，但与 mainstore 状态同步
    const [isAwake, setIsAwake] = useState(mainstore.speechIndicator.isAwake);
    const resetSilenceTimeout = () => {
        mainstore.resetSilenceTimeout();
    };

    //LAI YI 3.16 4.实现增强语音识别功能,为了避免不必要的重启，我们可以在组件中添加一个状态变量来记录上次处理的命令集
    // 在组件顶部的其他状态变量之后添加
    const [lastProcessedCommands, setLastProcessedCommands] = useState<string[]>([]);

    //添加状态变量跟踪初始化状态
    // 在组件顶部的其他状态变量之后添加
    const [grammarInitialized, setGrammarInitialized] = useState(false);


    // const commandTimeoutRefs = useRef<number[]>([]); // 用于存储命令超时的 Ref
    // const silenceTimeoutRef = useRef<number | null>(null); // 用于存储静默超时的 Ref

    //LAI YI 3.16 修改以支持多轮交互
    useEffect(() => {
        // 只要有任何语音活动(transcript变化)，就重置静默计时器
        // 不管识别结果是否正确，只要检测到语音输入就算
        if (mainstore.speechIndicator.isAwake && transcript) {
            console.log("Speech activity detected, resetting silence timeout");
            resetSilenceTimeout();
        }
    }, [transcript]); // 添加这个新的useEffect监听transcript变化

    // 处理唤醒词检测
    // 唤醒时只使用mainstore状态
    useEffect(() => {
        if (!mainstore.speechIndicator.isAwake && transcript.toLowerCase().includes("wake")) {
            console.log("Wake word detected: wake up");
            setIsAwake(true); // 唤醒助手
            mainstore.speechIndicator.isAwake = true // 更新状态到 store

            resetTranscript(); // 在检测到唤醒词后重置 transcript

            // 停止并以新模式重新启动
            SpeechRecognition.stopListening();
            setTimeout(() => { 
                SpeechRecognition.startListening({ continuous: true });
                // 开始静默检测
                resetSilenceTimeout();
            }, 100);
        }
    }, [transcript, mainstore.speechIndicator.isAwake]);

    // 同步本地状态和 mainstore 状态
    useEffect(() => {
        setIsAwake(mainstore.speechIndicator.isAwake);
    }, [mainstore.speechIndicator.isAwake]);

        // 同步 mainstore 状态和本地状态
    useEffect(() => {
        mainstore.speechIndicator.isAwake = isAwake;
    }, [isAwake]);

    //LAI YI 3.16
        // 关键改进：监听任何语音活动以重置静默计时器
    useEffect(() => {
        if (mainstore.speechIndicator.isAwake) {
            // 每当transcript有任何变化（检测到语音），就重置计时器
            // 这确保只有当用户完全停止说话超过5秒才会进入休眠
            console.log("Speech detected, resetting silence timeout");
            resetSilenceTimeout();
        }
    }, [transcript]); // 监听transcript的任何变化

    //Lai Yi 3.16 
    // // 自动停止监听并在识别结束时处理 transcript（(集成状态管理时使用mainstore.speechIndicator.isAwake等)
    // useEffect(() => {
    //     if (mainstore.speechIndicator.isAwake && !listening) {
    //         let finalTransript = transcript.trim()
    //         console.log("Final transcript:", finalTransript === "" ? "null" : finalTransript);
    //         if (finalTransript !== "") {
    //             // 当处理命令时停止处理上一个命令
    //             if (mainstore.apiState !== APIState.Sending) {
    //                 // // 重置静默超时（集成状态管理）
    //                 //LAI YI 3.16 只在非空转录时处理命令，但不再这里重置静默超时(已在transcript变化时处理)
    //                 // mainstore.resetSilenceTimeout();
                    
    //                 // 处理最终 transcript
    //                 mainstore.speech = finalTransript;
    //             }

    //             // 清除之前的 transcript
    //             resetTranscript();
    //         }
    //     }

    //             // 即使转录为空，也要确保继续监听
    //             let timeoutId = window.setTimeout(() => {
    //                 console.log("Restarting listening after recognition completed");
    //                 SpeechRecognition.startListening({ continuous: true });
    //                 mainstore.removeCommandTimeout(timeoutId);
    //             }, 100);
    //             mainstore.addCommandTimeout(timeoutId);

    //     // if (mainstore.speechIndicator.isAwake && !listening) {
    //     //     // 以高频率重新启动新模式
    //     //     let timeoutId = window.setTimeout(() => {
    //     //         console.log("current listening status", listening);
    //     //         SpeechRecognition.startListening({ continuous: true });

    //     //         // 不再本地移除超时计时器
    //     //         // commandTimeoutRefs.current = commandTimeoutRefs.current.filter((tempId) => tempId !== timeoutId);
    //     //         // 而是从 store 中移除超时计时器
    //     //         mainstore.removeCommandTimeout(timeoutId);
    //     //     }, 100);

    //     //     // 不在将超时ID添加到本地引用列表中
    //     //     // commandTimeoutRefs.current.push(timeoutId);
    //     //     // 而是将超时ID添加到 mainstore 中
    //     //     mainstore.addCommandTimeout(timeoutId);
    //     //     // console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);
    //     // }
    // }, [listening]); // 当 `listening` 状态改变时运行此效果
    //注释掉，换成新版本
    // 3. 关键修改：改进listening状态变化的处理
        // 确保语音识别始终在运行
    useEffect(() => {
        if (mainstore.speechIndicator.isAwake && !listening) {
            // 当语音识别停止时，处理任何最终结果
            let finalTranscript = transcript.trim();
            console.log("Recognition cycle ended, final transcript:", finalTranscript || "empty");
            
            // 处理非空结果
            //3.16 LAI YI 4.实现增强语音识别功能的修改
            if (finalTranscript !== "") {
            try{
            // 增强处理 - 检查是否是已知命令
                let isKnownCommand = mainstore.speechIndicator.availableCommands.some(
                    cmd => finalTranscript.toLowerCase().includes(cmd.toLowerCase())
                );

            // 获取Web Speech API的原始结果对象
                const recognition = (window as any).SpeechRecognition || 
                (window as any).webkitSpeechRecognition;

            // 尝试获取所有候选结果（如果有）
            if (!isKnownCommand && recognition && recognition.recognition && 
                recognition.recognition.results && recognition.recognition.results[0]) {
                console.log("Checking alternative recognition results...");
                
                const results = recognition.recognition.results[0];
                // 如果有多个结果，检查其他候选项
                if (results.length > 1) {
                    console.log(`Found ${results.length} alternative results`);
                    
                    // 遍历所有候选结果
                    for (let i = 1; i < results.length; i++) {
                        const altText = results[i].transcript.trim();
                        const altConfidence = results[i].confidence;
                        
                        console.log(`Alternative ${i}: "${altText}" (confidence: ${altConfidence})`);
                        
                        // 检查是否包含已知命令
                        const altMatches = mainstore.speechIndicator.availableCommands.some(
                            cmd => altText.toLowerCase().includes(cmd.toLowerCase())
                        );
                        
                        if (altMatches) {
                            console.log(`Found known command in alternative: "${altText}"`);
                            finalTranscript = altText;
                            isKnownCommand = true;
                            break;
                        }
                    }
                }
            }


                if (mainstore.apiState !== APIState.Sending) {
                    // 处理命令，如果找到已知命令或没有更好的替代品，处理最终结果
                    mainstore.speech = finalTranscript;
                    console.log(`Processing command: "${finalTranscript}"${isKnownCommand ? " (recognized command)" : ""}`);
                }
            } catch (processingError) {
                console.error("处理语音结果时出错:", processingError);
                // 尽管出错，仍尝试处理原始结果
                if (finalTranscript && mainstore.apiState !== APIState.Sending) {
                    mainstore.speech = finalTranscript;
                    console.log("由于错误，使用原始结果:", finalTranscript);
                }
            }
                resetTranscript();
            }
            
            // 无论如何，立即重启语音识别以确保持续监听
            let timeoutId = window.setTimeout(() => {
                try {
                    console.log("Restarting continuous listening...");
                    SpeechRecognition.startListening({ continuous: true });
                } catch (error) {
                    console.error("Failed to restart listening:", error);
                    // 失败后再次尝试，使用更长的延迟
                    setTimeout(() => {
                        SpeechRecognition.startListening({ continuous: true });
                    }, 500);
                }
                mainstore.removeCommandTimeout(timeoutId);
            }, 200); // 使用稍长的延迟以确保可靠重启
            
            mainstore.addCommandTimeout(timeoutId);
        }
    }, [listening, mainstore.speechIndicator.isAwake]);




    // 在组件卸载时清理
    useEffect(() => {
        return () => {
            stopListening();
            // clearSilenceTimeout();
            mainstore.clearSilenceTimeout();
        };
    }, []);

    // 通过 store 开始或停止监听
    useEffect(() => {
        if (mainstore.speechIndicator.startListening === true) {
            startListening();
        } else {
            stopListening();
        }
    }, [mainstore.speechIndicator.startListening]);

    // 通过 mainstore 进入休眠状态
    useEffect(() => {
        if (mainstore.speechIndicator.setToSleep === true) {
            setToSleep();
        }
    }, [mainstore.speechIndicator.setToSleep]);

    //LAI YI 3.16 4. 实现增强语音识别功能
    // 在 SpeechContainerV5 组件内，其他 useEffect 钩子之后添加这个新钩子
    //修正：替换下面这个语法初始化 useEffect
    // useEffect(() => {
    //     // 当组件挂载时初始化语法增强
    //     if (typeof window !== 'undefined' && mainstore.speechIndicator.grammarEnabled) {
    //     try {
    //         // 尝试获取底层 SpeechRecognition 对象
    //         const SpeechRecognitionAPI = window.SpeechRecognition || 
    //                                 window.webkitSpeechRecognition;
                                    
    //         // 获取 react-speech-recognition 的底层实例
    //         // 注意：我们需要先检查 SpeechRecognition 是否作为一个全局类可用
    //         if (SpeechRecognitionAPI) {
    //         console.log("找到 SpeechRecognition API");
            
    //         // 触发 mainstore 中的语法增强设置
    //         // 这将应用当前可用的命令列表
    //         mainstore.updateSpeechGrammar(mainstore.speechIndicator.availableCommands);
            
    //         console.log("已初始化语音识别语法增强");
    //         } else {
    //         console.warn("无法找到 SpeechRecognition API,语法增强将不可用");
    //         }
    //     } catch (error) {
    //         console.error("设置语音识别语法时出错:", error);
    //     }
    //     }
    // }, []); // 空依赖数组意味着这个效果只在组件挂载时运行一次
    useEffect(() => {
        // 只在组件挂载时初始化一次
        if (!grammarInitialized && mainstore.speechIndicator.grammarEnabled) {
        const success = initializeSpeechGrammar();
        setGrammarInitialized(success);
        
        if (success) {
            console.log("语音语法增强初始化成功");
        } else {
            console.warn("语音语法增强初始化失败，将使用基本语音识别");
        }
        }
        
        // 返回清理函数
        return () => {
        // 清理语音识别资源
        if (grammarInitialized) {
            try {
            // 停止语音识别
            SpeechRecognition.stopListening();
            
            // 清除所有超时计时器
            mainstore.clearCommandTimeouts();
            mainstore.clearSilenceTimeout();
            
            console.log("语音语法增强资源已清理");
            } catch (error) {
            console.error("清理语音识别资源时出错:", error);
            }
        }
        };
    }, [grammarInitialized]); // 只依赖于 grammarInitialized 状态

    //LAI YI 3.16 5. 实现增强语音识别功能,添加一个机制，使得当命令集变化时，语法模型能够自动刷新。
    // 添加新的 useEffect 钩子来监听命令变化
    // 修改后的 useEffect 钩子
    useEffect(() => {
        // 仅当助手处于唤醒状态且语法增强已启用时处理
        if (mainstore.speechIndicator.isAwake && mainstore.speechIndicator.grammarEnabled) {
            // 获取当前命令列表
            const currentCommands = mainstore.speechIndicator.availableCommands;
            
            // 检查命令列表是否真的变化了
            const hasChanged = lastProcessedCommands.length !== currentCommands.length || 
                            !lastProcessedCommands.every((cmd, i) => cmd === currentCommands[i]);
            
            if (hasChanged) {
                console.log("检测到命令列表变化，更新语音语法模型", currentCommands);
                
                // 通过 mainstore 更新语法模型
                mainstore.updateSpeechGrammar(currentCommands);
                
                // 更新上次处理的命令列表
                setLastProcessedCommands([...currentCommands]);
                
                // 如果当前正在监听，可能需要重启监听以应用新语法
                if (listening) {
                    console.log("重启语音识别以应用新语法模型");
                    
                    // 停止当前监听
                    SpeechRecognition.stopListening();
                    
                    // 清除所有超时计时器
                    mainstore.clearCommandTimeouts();
                    
                    // 短暂延迟后重新开始监听
                    const timeoutId = window.setTimeout(() => {
                        try {
                            SpeechRecognition.startListening({ continuous: true });
                            console.log("成功重启语音识别");
                        } catch (error) {
                            console.error("重启语音识别失败:", error);
                            // 失败后再次尝试
                            setTimeout(() => {
                                SpeechRecognition.startListening({ continuous: true });
                            }, 500);
                        }
                        
                        // 从 mainstore 中移除超时计时器
                        mainstore.removeCommandTimeout(timeoutId);
                    }, 300);
                    
                    // 将超时ID添加到 mainstore 中
                    mainstore.addCommandTimeout(timeoutId);
                }
            }
        }
    }, [mainstore.speechIndicator.availableCommands, mainstore.speechIndicator.isAwake, lastProcessedCommands, listening]); // 依赖项更新


    // 添加到其他 useEffect 钩子之后
        useEffect(() => {
        // 只有在组件挂载且语法增强启用时才设置增强处理
        if (mainstore.speechIndicator.grammarEnabled) {
            // 调用增强函数并获取清理函数
            const cleanup = enhanceRecognitionResults();
            
            // 返回清理函数
            return () => {
            if (cleanup) cleanup();
            };
        }
        }, []); // 空依赖数组确保只在组件挂载时执行一次

    //LAIYI 放在Mainstore中
    // // 重置静默超时
    // const resetSilenceTimeout = () => {
    //     // 清除现有超时
    //     clearSilenceTimeout();
        
    //     // 设置新的静默超时
    //     silenceTimeoutRef.current = window.setTimeout(() => {
    //         console.log(`Silence detected for ${silenceDuration/1000} seconds. Stopping listening...`);
    //         setToSleep(); // 如果检测到静默，则进入休眠模式
    //     }, silenceDuration);
    // };

    // // 清除静默超时
    // const clearSilenceTimeout = () => {
    //     if (silenceTimeoutRef.current) {
    //         clearTimeout(silenceTimeoutRef.current);
    //         silenceTimeoutRef.current = null;
    //     }
    // };

    // 开始监听
    const startListening = () => {
        SpeechRecognition.startListening({ continuous: true }); // 以连续模式开始
    };

    // 停止监听
    const stopListening = () => {
        // 清除命令超时
        // clearCommandTimeout();
        mainstore.clearCommandTimeouts();
        // 清除静默超时
        // clearSilenceTimeout();
        mainstore.clearSilenceTimeout();


        SpeechRecognition.stopListening();

        setIsAwake(false); // 让助手回到休眠状态
        mainstore.speechIndicator.isAwake = false; // 更新状态到 store
    };

    // 进入休眠模式
    const setToSleep = () => {
        // 清除命令超时以避免将监听设置为连续
        // clearCommandTimeout();
        mainstore.clearCommandTimeouts();
        // 清除静默超时
        // clearSilenceTimeout();
        mainstore.clearSilenceTimeout();

        // 以新模式重新启动
        SpeechRecognition.stopListening();
        // 小延迟确保停止动作完成
        setTimeout(() => { SpeechRecognition.startListening({ continuous: true }) }, 100);

        setIsAwake(false); // 让助手回到休眠状态
        mainstore.speechIndicator.isAwake = false; // 更新状态到 store
        
        // 重置 mainstore 中的 setToSleep 标志
        mainstore.speechIndicator.setToSleep = false;
    };

    //
    // 添加到 SpeechContainerV5 组件中，与 startListening、stopListening 等函数放在一起
    const enhanceRecognitionResults = () => {
        if (typeof window === 'undefined') return;
        
        // 访问原始的 SpeechRecognition API
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        // 尝试获取 recognition 实例
        let recognition;
        
        if ((window as any).SpeechRecognition && (window as any).SpeechRecognition.recognition) {
          recognition = (window as any).SpeechRecognition.recognition;
        } else if ((window as any).recognition) {
          recognition = (window as any).recognition;
        } else if (SpeechRecognitionAPI) {
          try {
            recognition = new SpeechRecognitionAPI();
            (window as any).recognition = recognition; // 保存引用
          } catch (error) {
            console.error("无法创建 SpeechRecognition 实例:", error);
            return;
          }
        }
        
        if (!recognition) {
          console.warn("无法访问 SpeechRecognition 实例，增强处理将不可用");
          return;
        }
        
        // 保存原始 onresult 处理函数
        const originalOnResult = recognition.onresult;
        
        // 替换 onresult 处理函数
        recognition.onresult = (event) => {
          // 首先调用原始处理函数（如果存在）
          if (originalOnResult) {
            try {
              originalOnResult.call(recognition, event);
            } catch (error) {
              console.error("调用原始 onresult 处理函数时出错:", error);
            }
          }
          
          // 增强处理 - 在这里添加自定义逻辑
          if (mainstore.speechIndicator.isAwake && event.results && event.results[0]) {
            const results = event.results[0];
            
            console.log(`接收到识别结果，有 ${results.length} 个候选项`);
            
            // 定义明确的类型
            interface Candidate {
              text: string;
              confidence: number;
            }
            
            // 使用明确类型的数组
            const candidates: Candidate[] = [];
            
            for (let i = 0; i < results.length; i++) {
              const candidate = results[i].transcript.trim();
              const confidence = results[i].confidence;
              
              candidates.push({ text: candidate, confidence: confidence });
              console.log(`候选 ${i+1}: "${candidate}" (置信度: ${confidence.toFixed(2)})`);
              
              // 检查是否是已知命令
              const matchedCommands = mainstore.speechIndicator.availableCommands.filter(
                cmd => candidate.toLowerCase().includes(cmd.toLowerCase())
              );
              
              if (matchedCommands.length > 0) {
                console.log(`候选 ${i+1} 匹配这些命令:`, matchedCommands);
              }
            }
            
            // 寻找最佳命令匹配
            let bestMatch: string | null = null;
            let bestConfidence = 0;
            let bestCommand = "";
            
            for (const candidate of candidates) {
              for (const command of mainstore.speechIndicator.availableCommands) {
                if (candidate.text.toLowerCase().includes(command.toLowerCase())) {
                  if (candidate.confidence > bestConfidence) {
                    bestMatch = candidate.text;
                    bestConfidence = candidate.confidence;
                    bestCommand = command;
                  }
                }
              }
            }
            
            if (bestMatch && bestConfidence > 0.4) { // 使用置信度阈值
              console.log(`发现最佳命令匹配: "${bestMatch}" → "${bestCommand}" (置信度: ${bestConfidence.toFixed(2)})`);
            }
          }
        };
        
        console.log("已设置增强的 onresult 处理");
        
        // 返回清理函数
        return () => {
          // 恢复原始 onresult 处理函数
          if (recognition) {
            recognition.onresult = originalOnResult;
            console.log("已恢复原始 onresult 处理");
          }
        };
      };

    // 添加到其他功能函数之后
const initializeSpeechGrammar = () => {
    try {
      if (typeof window === 'undefined' || !mainstore.speechIndicator.grammarEnabled) return false;
      
      console.log("开始初始化语音语法增强...");
      
      // 1. 确保语法功能在 mainstore 中已设置
      mainstore.setupSpeechGrammar();
      
      // 2. 加载当前的命令列表
      const currentCommands = mainstore.speechIndicator.availableCommands;
      setLastProcessedCommands([...currentCommands]);
      
      // 3. 初始化 onresult 增强处理
      const cleanupEnhancement = enhanceRecognitionResults();
      
      // 4. 设置错误恢复机制
      window.addEventListener('error', (event) => {
        if (event.message && event.message.includes('SpeechRecognition')) {
          console.error("语音识别出现错误，尝试恢复:", event.message);
          // 尝试恢复监听
          if (mainstore.speechIndicator.isAwake) {
            setTimeout(() => {
              try {
                SpeechRecognition.startListening({ continuous: true });
                console.log("成功恢复语音识别");
              } catch (e) {
                console.error("恢复语音识别失败:", e);
              }
            }, 1000);
          }
        }
      });
      
      console.log("语音语法增强初始化完成", currentCommands);
      return true;
    } catch (error) {
      console.error("初始化语音语法增强时出错:", error);
      return false;
    }
  };

    //LAIYI 3.15 resetSilenceTimeout用不到了吗？
    

    // const clearCommandTimeout = () => {
    //     // 使用其 ID 清除每个超时
    //     commandTimeoutRefs.current.forEach((timeoutId) => {
    //         clearTimeout(timeoutId);
    //     });
    //     commandTimeoutRefs.current = [];
    // };

    // 显示当前的语音状态（UI 部分保持不变）
    const showSpeechStatus = () => {
        if (mainstore.speechIndicator.isAwake === true) {// 唤醒
            if (mainstore.apiState === APIState.Sending) {// 处理中
                return (<Flex gap={3} align='center' style={{ width: "100%" }}>
                    <MicOff color="rgb(239 68 68)" size={22} />
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                        <div style={{
                            width: "95%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "center",
                            backgroundColor: "#fff",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            padding: 6,
                            margin: 6
                        }}>Processing now, please wait.</div>
                    </div>
                </Flex>)
            } else {// 非处理中
                if (transcript) {// 显示说话状态
                    return (<Flex gap={3} align='center' style={{ width: "100%" }}>
                        <Volume2 color="rgb(59 130 246)" size={22} />
                        <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                            <div style={{
                                width: "95%",
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                textAlign: "center",
                                backgroundColor: "#fff",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                padding: 6,
                                margin: 6
                            }}>{transcript}</div>
                        </div>
                    </Flex>)
                } else {// 通知用户说话以交互
                    // 格式化静默时间为秒，便于阅读，使用mainstore的silenceDuration
                    const silenceInSeconds = Math.round(mainstore.speechIndicator.silenceDuration / 1000);
                    
                    return (<Flex gap={3} align='center' style={{ width: "100%" }}>
                        <Mic color="rgb(34 197 94)" size={22} />
                        <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                            <div style={{
                                width: "95%",
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                textAlign: "center",
                                backgroundColor: "#fff",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                padding: 6,
                                margin: 6
                            }}>
                                Speak to interact
                                <div style={{ 
                                    fontSize: "0.85em", 
                                    color: "#666", 
                                    marginTop: 4 
                                }}>
                                    (System will stop listening after {silenceInSeconds} seconds of silence)
                                </div>
                            </div>
                        </div>
                    </Flex>)
                }
            }
        } else {// 未唤醒
            // 格式化静默时间为秒，便于阅读，使用mainstore的silenceDuration
            const silenceInSeconds = Math.round(mainstore.speechIndicator.silenceDuration / 1000);
            
            return (
                <Flex gap={3} align='center' style={{ width: "100%" }}>
                    <MicOff color="rgb(239 68 68)" size={22} />
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                        <div style={{
                            width: "95%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "center",
                            backgroundColor: "#fff",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            padding: 6,
                            margin: 6
                        }}>
                            Say "Wake up" to interact
                            <div style={{ 
                                fontSize: "0.85em", 
                                color: "#666", 
                                marginTop: 4 
                            }}>
                                (System will stop listening after {silenceInSeconds} seconds of silence)
                            </div>
                        </div>
                    </div>
                </Flex>
            )
        }
    }

    const render = () => {
        return (
            <Flex vertical justify='flex-start' align='flex-start' style={{
                width: "100%",
                padding: 3,
                borderRadius: 6,
                backgroundColor: "#f9f9f9",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}>
                {showSpeechStatus()}
            </Flex>
        );
    };

    return render();
})




// FIXME: state management with store only
// without unitNow shown
// export const SpeechContainerV5 = observer(({ mainstore }: { mainstore: MainStore }) => {
//     const {
//         transcript,
//         listening,
//         resetTranscript,
//     } = useSpeechRecognition();

//     const countLimit = mainstore.speechIndicator.commandLimitNum // max command to take before setting to sleep
//     const [count, setCount] = useState(0); // commands count
//     const [isAwake, setIsAwake] = useState(false); // State to track if the assistant is awake
//     const commandTimeoutRefs = useRef<number[]>([]); // Ref to store the command timeout

//     // Handle wake word detection
//     useEffect(() => {
//         if (!isAwake && transcript.toLowerCase().includes("wake")) {
//             console.log("Wake word detected: hi speech");

//             setIsAwake(true); // Wake up the assistant
//             mainstore.speechIndicator.isAwake = true // update state to store

//             resetTranscript(); // Reset transcript after wake word is detected

//             // stop to restart with the new mode
//             SpeechRecognition.stopListening();
//             setTimeout(() => { SpeechRecognition.startListening({ continuous: false }) }, 50);
//         }
//     }, [transcript, isAwake]);

//     // Automatically stop listening and process the transcript when recognition ends
//     useEffect(() => {
//         if (isAwake && !listening) {
//             let finalTransript = transcript.trim()
//             console.log("Final transcript:", finalTransript == "" ? "null" : finalTransript);
//             if (finalTransript != "") {
//                 // stop handling command when last command is under processing 
//                 // add condition here to make sure command being cleared while processing
//                 if (mainstore.apiState != APIState.Sending) {
//                     // track numbers of commands
//                     setCount((pre) => pre + 1)

//                     // update to store
//                     mainstore.speechIndicator.restartCount = count

//                     // handle based on the final transcript
//                     mainstore.speech = finalTransript
//                 }

//                 // Clear any previous transcript
//                 resetTranscript();
//             }
//         }

//         // fix bug: sometimes assistant is not active properly, 
//         // remove condition to run startListening({ continuous: false })
//         // if (isAwake && !listening) {
//         //     // Restart with the new mode at high frequency
//         //     let timeoutId = window.setTimeout((listening) => {
//         //         // act based on current listening status 
//         //         if (!listening) {
//         //             console.log("current listening status", listening);
//         //             SpeechRecognition.startListening({ continuous: false })

//         //             // remove timeout timers
//         //             commandTimeoutRefs.current = commandTimeoutRefs.current.filter((tempId) => tempId != timeoutId)
//         //         }
//         //     }, 50, listening);

//         //     // Add the timeout ID to the list in the ref
//         //     commandTimeoutRefs.current.push(timeoutId);
//         //     console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);
//         // }
//         //LAI YI 3.15 第一部分修改
//         // if (isAwake && !listening) {
//         //     // Restart with the new mode at high frequency
//         //     let timeoutId = window.setTimeout(() => {
//         //         console.log("current listening status", listening);
//         //         SpeechRecognition.startListening({ continuous: false })

//         //         // remove timeout timers
//         //         commandTimeoutRefs.current = commandTimeoutRefs.current.filter((tempId) => tempId != timeoutId)
//         //     }, 50);

//         //     // Add the timeout ID to the list in the ref
//         //     commandTimeoutRefs.current.push(timeoutId);
//         //     console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);
//         // }
//         //注释掉上面部分并替换成下面的if这部分
//         if (isAwake && !listening) {
//             // Restart with the new mode with increased delay and error handling
//             let timeoutId = window.setTimeout(() => {
//                 console.log("current listening status", listening);
//                 try {
//                     SpeechRecognition.startListening({ continuous: false });
//                     console.log("重新启动监听");
//                 } catch (error) {
//                     console.error("启动语音识别失败:", error);
//                     // 失败后再次尝试
//                     setTimeout(() => {
//                         SpeechRecognition.startListening({ continuous: false });
//                     }, 300);
//                 }
                
//                 // remove timeout timers
//                 commandTimeoutRefs.current = commandTimeoutRefs.current.filter((tempId) => tempId != timeoutId)
//             }, 300); // 延长延迟为300ms，给语音API更多恢复时间
        
//             // Add the timeout ID to the list in the ref
//             commandTimeoutRefs.current.push(timeoutId);
//             console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);
//         }

//         // set back to sleep when executing several commands
//         if (count > countLimit) {
//             setToSleep()
//         }
//     }, [listening]); // Run this effect when the `listening` state changes

//     // Clean up on component unmount
//     useEffect(() => {
//         // the return function here will run when component unmount
//         return () => {
//             stopListening()

//             // Clear timeout if active
//             // clearCommandTimeout()
//         };
//     }, []);

//     // start or stop listening by store
//     useEffect(() => {
//         if (mainstore.speechIndicator.startListening == true) {
//             startListening()
//         } else {
//             stopListening()
//         }
//     }, [mainstore.speechIndicator.startListening]);

//     // set to sleep by mainstore
//     useEffect(() => {
//         if (mainstore.speechIndicator.setToSleep == true) {
//             setToSleep()
//         }
//     }, [mainstore.speechIndicator.setToSleep]);

//     // Start listening
//     const startListening = () => {
//         SpeechRecognition.startListening({ continuous: true }); // Start in continuous mode
//     };

//     // Stop listening
//     const stopListening = () => {
//         // clear command timeout
//         clearCommandTimeout()

//         SpeechRecognition.stopListening();

//         setIsAwake(false); // Put the assistant back to sleep
//         mainstore.speechIndicator.isAwake = false // update state to store
//         setCount(0)
//         // console.log("Assistant is now stopped.");
//     };

//     // Set to sleep mode
//     const setToSleep = () => {
//         // clear command timeout to avoid set listening to continuous
//         clearCommandTimeout()

//         // Restart with the new mode
//         SpeechRecognition.stopListening();
//         // Small delay to ensure the stop action completes
//         setTimeout(() => { SpeechRecognition.startListening({ continuous: true }) }, 50);

//         setIsAwake(false); // Put the assistant back to sleep
//         mainstore.speechIndicator.isAwake = false // update state to store
//         setCount(0)
//         // console.log("Assistant is now asleep.");
//     };

//     const clearCommandTimeout = () => {
//         // console.log("clearCommandTimeout is beginning");
//         // console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);

//         // Clear each timeout using its ID
//         commandTimeoutRefs.current.forEach((timeoutId) => {
//             clearTimeout(timeoutId);
//         });
//         commandTimeoutRefs.current = [];

//         // console.log("clearCommandTimeout is end");
//         // console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);
//     };

//     // colors:
//     // mute: rgb(239 68 68 / var(--tw-text-opacity))
//     // speak: rgb(34 197 94 / var(--tw-text-opacity))
//     // speaking: rgb(59 130 246 / var(--tw-text-opacity))
//     const showSpeechStatus = () => {
//         if (mainstore.speechIndicator.isAwake == true) {// awake
//             if (mainstore.apiState == APIState.Sending) {// processing
//                 return (<Flex gap={3} align='center' style={{ width: "100%" }}>
//                     <MicOff color="rgb(239 68 68)" size={22} />
//                     <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
//                         <div style={{
//                             width: "95%",
//                             wordWrap: "break-word",
//                             overflowWrap: "break-word",
//                             textAlign: "center",
//                             // backgroundColor: "#8585e0", // purple
//                             backgroundColor: "#fff",
//                             borderRadius: 6,
//                             border: "1px solid #ddd",
//                             padding: 6,
//                             margin: 6
//                         }}>Processing now, please wait.</div>
//                     </div>
//                 </Flex>)
//             } else {// not processing
//                 if (transcript) {// show speaking status
//                     return (<Flex gap={3} align='center' style={{ width: "100%" }}>
//                         <Volume2 color="rgb(59 130 246)" size={22} />
//                         <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
//                             <div style={{
//                                 width: "95%",
//                                 wordWrap: "break-word",
//                                 overflowWrap: "break-word",
//                                 textAlign: "center",
//                                 // backgroundColor: "#8585e0", // purple
//                                 backgroundColor: "#fff",
//                                 borderRadius: 6,
//                                 border: "1px solid #ddd",
//                                 padding: 6,
//                                 margin: 6
//                             }}>{transcript}</div>
//                         </div>
//                     </Flex>)
//                 } else {// inform user to speak to interact
//                     return (<Flex gap={3} align='center' style={{ width: "100%" }}>
//                         <Mic color="rgb(34 197 94)" size={22} />
//                         <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
//                             <div style={{
//                                 width: "95%",
//                                 wordWrap: "break-word",
//                                 overflowWrap: "break-word",
//                                 textAlign: "center",
//                                 // backgroundColor: "#8585e0", // purple
//                                 backgroundColor: "#fff",
//                                 borderRadius: 6,
//                                 border: "1px solid #ddd",
//                                 padding: 6,
//                                 margin: 6
//                             }}>Speak to interact</div>
//                         </div>
//                     </Flex>)
//                 }
//             }
//         } else {// not awake
//             return (
//                 <Flex gap={3} align='center' style={{ width: "100%" }}>
//                     <MicOff color="rgb(239 68 68)" size={22} />
//                     <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
//                         <div style={{
//                             width: "95%",
//                             wordWrap: "break-word",
//                             overflowWrap: "break-word",
//                             textAlign: "center",
//                             // backgroundColor: "#8585e0", // purple
//                             backgroundColor: "#fff",
//                             borderRadius: 6,
//                             border: "1px solid #ddd",
//                             padding: 6,
//                             margin: 6
//                         }}>Say "Wake up" to interact</div>
//                     </div>
//                 </Flex>
//             )
//         }
//     }

//     const render = () => {
//         return (
//             <Flex vertical justify='flex-start' align='flex-start' style={{
//                 width: "100%",
//                 padding: 3,
//                 borderRadius: 6,
//                 backgroundColor: "#f9f9f9",
//                 boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
//             }}>
//                 {showSpeechStatus()}
//             </Flex>
//         );
//     };

//     return render();
// })

// state management within component and store,
// with unitNow message,
// with slience timeout commented 
export const SpeechContainerV4 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const {
        transcript,
        listening,
        resetTranscript,
    } = useSpeechRecognition();

    const countLimit = mainstore.speechIndicator.commandLimitNum // max command to take before setting to sleep
    const [count, setCount] = useState(0); // commands count
    const [isAwake, setIsAwake] = useState(false); // State to track if the assistant is awake
    const commandTimeoutRefs = useRef<number[]>([]); // Ref to store the command timeout

    // Handle wake word detection
    useEffect(() => {
        if (!isAwake && transcript.toLowerCase().includes("wake")) {
            console.log("Wake word detected: hi speech");

            setIsAwake(true); // Wake up the assistant
            mainstore.speechIndicator.isAwake = true // update state to store

            resetTranscript(); // Reset transcript after wake word is detected

            // stop to restart with the new mode
            SpeechRecognition.stopListening();
            setTimeout(() => { SpeechRecognition.startListening({ continuous: false }) }, 50);
        }
    }, [transcript, isAwake]);

    // Automatically stop listening and process the transcript when recognition ends
    useEffect(() => {
        if (isAwake && !listening) {
            let finalTransript = transcript.trim()
            console.log("Final transcript:", finalTransript == "" ? "null" : finalTransript);
            if (finalTransript != "") {
                // stop handling command when last command is under processing 
                // add condition here to make sure command being cleared while processing
                if (mainstore.apiState != APIState.Sending) {
                    // track numbers of commands
                    setCount((pre) => pre + 1)

                    // update to store
                    mainstore.speechIndicator.restartCount = count

                    // handle based on the final transcript
                    mainstore.speech = finalTransript
                }

                // Clear any previous transcript
                resetTranscript();
            }
        }

        // fix bug: sometimes assistant is not active properly, 
        // remove condition to run startListening({ continuous: false })
        // if (isAwake && !listening) {
        //     // Restart with the new mode at high frequency
        //     let timeoutId = window.setTimeout((listening) => {
        //         // act based on current listening status 
        //         if (!listening) {
        //             console.log("current listening status", listening);
        //             SpeechRecognition.startListening({ continuous: false })

        //             // remove timeout timers
        //             commandTimeoutRefs.current = commandTimeoutRefs.current.filter((tempId) => tempId != timeoutId)
        //         }
        //     }, 50, listening);

        //     // Add the timeout ID to the list in the ref
        //     commandTimeoutRefs.current.push(timeoutId);
        //     console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);
        // }
        if (isAwake && !listening) {
            // Restart with the new mode at high frequency
            let timeoutId = window.setTimeout(() => {
                console.log("current listening status", listening);
                SpeechRecognition.startListening({ continuous: false })

                // remove timeout timers
                commandTimeoutRefs.current = commandTimeoutRefs.current.filter((tempId) => tempId != timeoutId)
            }, 50);

            // Add the timeout ID to the list in the ref
            commandTimeoutRefs.current.push(timeoutId);
            console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);
        }

        // set back to sleep when executing several commands
        if (count > countLimit) {
            setToSleep()
        }
    }, [listening]); // Run this effect when the `listening` state changes

    // Clean up on component unmount
    useEffect(() => {
        // the return function here will run when component unmount
        return () => {
            stopListening()

            // Clear timeout if active
            // clearCommandTimeout()
        };
    }, []);

    // start or stop listening by store
    useEffect(() => {
        if (mainstore.speechIndicator.startListening == true) {
            startListening()
        } else {
            stopListening()
        }
    }, [mainstore.speechIndicator.startListening]);

    // set to sleep by mainstore
    useEffect(() => {
        if (mainstore.speechIndicator.setToSleep == true) {
            setToSleep()
        }
    }, [mainstore.speechIndicator.setToSleep]);

    // Start listening
    const startListening = () => {
        SpeechRecognition.startListening({ continuous: true }); // Start in continuous mode
    };

    // Stop listening
    const stopListening = () => {
        // clear command timeout
        clearCommandTimeout()

        SpeechRecognition.stopListening();

        setIsAwake(false); // Put the assistant back to sleep
        mainstore.speechIndicator.isAwake = false // update state to store
        setCount(0)
        // console.log("Assistant is now stopped.");
    };

    // Set to sleep mode
    const setToSleep = () => {
        // clear command timeout to avoid set listening to continuous
        clearCommandTimeout()

        // Restart with the new mode
        SpeechRecognition.stopListening();
        // Small delay to ensure the stop action completes
        setTimeout(() => { SpeechRecognition.startListening({ continuous: true }) }, 50);

        setIsAwake(false); // Put the assistant back to sleep
        mainstore.speechIndicator.isAwake = false // update state to store
        setCount(0)
        // console.log("Assistant is now asleep.");
    };

    const clearCommandTimeout = () => {
        // console.log("clearCommandTimeout is beginning");
        // console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);

        // Clear each timeout using its ID
        commandTimeoutRefs.current.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        commandTimeoutRefs.current = [];

        // console.log("clearCommandTimeout is end");
        // console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);
    };

    // colors:
    // mute: rgb(239 68 68 / var(--tw-text-opacity))
    // speak: rgb(34 197 94 / var(--tw-text-opacity))
    // speaking: rgb(59 130 246 / var(--tw-text-opacity))
    const showSpeechStatus = () => {
        if (mainstore.speechIndicator.isAwake == true) {// awake
            if (mainstore.apiState == APIState.Sending) {// processing
                return (<Flex gap={3} align='center' style={{ width: "100%" }}>
                    <MicOff color="rgb(239 68 68)" size={22} />
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                        <div style={{
                            width: "95%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "center",
                            // backgroundColor: "#8585e0", // purple
                            backgroundColor: "#fff",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            padding: 6,
                            margin: 6
                        }}>Processing now, please wait.</div>
                    </div>
                </Flex>)
            } else {// not processing
                if (transcript) {// show speaking status
                    return (<Flex gap={3} align='center' style={{ width: "100%" }}>
                        <Volume2 color="rgb(59 130 246)" size={22} />
                        <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                            <div style={{
                                width: "95%",
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                textAlign: "center",
                                // backgroundColor: "#8585e0", // purple
                                backgroundColor: "#fff",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                padding: 6,
                                margin: 6
                            }}>{transcript}</div>
                        </div>
                    </Flex>)
                } else {// inform user to speak to interact
                    return (<Flex gap={3} align='center' style={{ width: "100%" }}>
                        <Mic color="rgb(34 197 94)" size={22} />
                        <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                            <div style={{
                                width: "95%",
                                wordWrap: "break-word",
                                overflowWrap: "break-word",
                                textAlign: "center",
                                // backgroundColor: "#8585e0", // purple
                                backgroundColor: "#fff",
                                borderRadius: 6,
                                border: "1px solid #ddd",
                                padding: 6,
                                margin: 6
                            }}>Speak to interact</div>
                        </div>
                    </Flex>)
                }
            }
        } else {// not awake
            return (
                <Flex gap={3} align='center' style={{ width: "100%" }}>
                    <MicOff color="rgb(239 68 68)" size={22} />
                    <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                        <div style={{
                            width: "95%",
                            wordWrap: "break-word",
                            overflowWrap: "break-word",
                            textAlign: "center",
                            // backgroundColor: "#8585e0", // purple
                            backgroundColor: "#fff",
                            borderRadius: 6,
                            border: "1px solid #ddd",
                            padding: 6,
                            margin: 6
                        }}>Say "Wake up" to interact</div>
                    </div>
                </Flex>
            )
        }
    }

    const showUnitNow = () => {
        // FIXME: add one condition to make sure the tool is awake to show unitNow
        // mainstore.speechIndicator.isAwake
        if ((mainstore.interactions.length > 0 || mainstore.redoList.length > 0)) {
            const unitNow = mainstore.unitNow

            if (unitNow) {
                return (
                    <div style={{ width: "100%" }}>
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
                            }}>{unitNow.speech.text}</div>
                        </div>
                        {
                            unitNow.feedbackSpeech ?
                                <div style={{ width: "100%", display: "flex", justifyContent: "flex-start" }}>
                                    <div style={{
                                        maxWidth: "85%",
                                        wordWrap: "break-word",
                                        overflowWrap: "break-word",
                                        textAlign: "left",
                                        // backgroundColor: "#f7f7f7", // light gray
                                        backgroundColor: "#fff",
                                        borderRadius: 6,
                                        // border: "1px solid #ddd",
                                        padding: 6,
                                        margin: 6
                                    }}>{unitNow.feedbackSpeech.text}</div>
                                </div> : ""
                        }
                    </div>
                )
            } else {
                console.log("unitNow is null.");
            }
        }
    }

    const showButtons = () => {
        if (mainstore.speechIndicator.showSpeechControlButtons) {
            return (
                <Flex gap={10} vertical justify='flex-start' align='flex-start' style={{ width: "100%", padding: 5 }}>
                    <Button size='small' onClick={startListening} disabled={listening || isAwake}>Start Listening</Button>
                    <Button size='small' onClick={setToSleep} disabled={!listening && !isAwake}>Set to Sleep</Button>
                    <Button size='small' onClick={stopListening} disabled={!listening && !isAwake}>Stop Listening</Button>
                    <span>Restart count: {count}</span>
                </Flex>
            )
        }
    }

    const render = () => {
        return (
            <Flex vertical justify='flex-start' align='flex-start' style={{
                width: "100%",
                padding: 3,
                borderRadius: 6,
                backgroundColor: "#f9f9f9",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}>
                {showUnitNow()}
                {showSpeechStatus()}
                {/* {showButtons()} */}
            </Flex>
        );
    };

    return render();

    // add silence timeout
    // const silenceTimeoutRef = useRef<number | null>(null); // Ref to store the silence timeout
    // Handle silence detection
    // useEffect(() => {
    //     // if (count > 0 && isAwake == false)
    //     //     setCount(0)

    //     // if (isAwake) {
    //     //     // Reset the silence timeout whenever there's activity (listening)
    //     //     resetSilenceTimeout();
    //     // }

    //     // return () => {
    //     //     clearSilenceTimeout(); // Clean up the timeout
    //     // };
    // }, [isAwake]);

    // const resetSilenceTimeout = () => {
    //     // Clear any existing timeout
    //     if (silenceTimeoutRef.current) {
    //         clearTimeout(silenceTimeoutRef.current);
    //     }

    //     // Set a new timeout for 3 seconds
    //     silenceTimeoutRef.current = window.setTimeout(() => {
    //         console.log("Silence detected for 10 seconds. Stopping listening...");
    //         setToSleep(); // Set to sleep if silence is detected
    //         alert("time out")
    //     }, 5000); // 5000ms = 5 seconds
    // };

    // const clearSilenceTimeout = () => {
    //     if (silenceTimeoutRef.current) {
    //         clearTimeout(silenceTimeoutRef.current);
    //         silenceTimeoutRef.current = null;
    //     }
    // };
})

export const SpeechContainerV3 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition,
    } = useSpeechRecognition();

    const countLimit = 5
    const [count, setCount] = useState(0); // commands count
    const [isAwake, setIsAwake] = useState(false); // State to track if the assistant is awake
    const commandTimeoutRefs = useRef<number[]>([]); // Ref to store the command timeout
    const silenceTimeoutRef = useRef<number | null>(null); // Ref to store the silence timeout

    // Handle wake word detection
    useEffect(() => {
        if (!isAwake && transcript.toLowerCase().includes("hi speech")) {
            console.log("Wake word detected: hi speech");
            setIsAwake(true); // Wake up the assistant
            resetTranscript(); // Reset transcript after wake word is detected

            // stop to restart with the new mode
            SpeechRecognition.stopListening();
            setTimeout(() => { SpeechRecognition.startListening({ continuous: false }) }, 50);
        }
    }, [transcript, isAwake]);

    // Automatically stop listening and process the transcript when recognition ends
    useEffect(() => {
        if (isAwake && !listening) {
            let finalTransript = transcript.trim()
            console.log("Final transcript:", finalTransript == "" ? "null" : finalTransript);
            if (finalTransript != "") {
                // track numbers of commands
                setCount((pre) => pre + 1)

                // handle based on the final transcript
                mainstore.speech = finalTransript

                // testing command handling
                handleCommand(finalTransript)

                // Clear any previous transcript
                resetTranscript();
            }
        }

        if (isAwake && !listening) {
            // Restart with the new mode at high frequency
            let timeoutId = window.setTimeout((listening) => {
                // act based on current listening status 
                if (!listening) {
                    console.log("current listening status", listening);
                    SpeechRecognition.startListening({ continuous: false })

                    // remove timeout timers
                    commandTimeoutRefs.current = commandTimeoutRefs.current.filter((tempId) => tempId != timeoutId)
                }
            }, 50, listening);

            // Add the timeout ID to the list in the ref
            commandTimeoutRefs.current.push(timeoutId);
            console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);
        }

        // set back to sleep when executing several commands
        if (count > countLimit) {
            stopListening()
        }
    }, [listening]); // Run this effect when the `listening` state changes

    // Clean up on component unmount
    useEffect(() => {
        // the return function here will run when component unmount
        return () => {
            // Clear timeout if active
            clearCommandTimeout()
        };
    }, []);

    // Handle silence detection
    // useEffect(() => {
    //     // if (count > 0 && isAwake == false)
    //     //     setCount(0)

    //     // if (isAwake) {
    //     //     // Reset the silence timeout whenever there's activity (listening)
    //     //     resetSilenceTimeout();
    //     // }

    //     // return () => {
    //     //     clearSilenceTimeout(); // Clean up the timeout
    //     // };
    // }, [isAwake]);

    const clearCommandTimeout = () => {
        // console.log("clearCommandTimeout is beginning");
        // console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);

        // Clear each timeout using its ID
        commandTimeoutRefs.current.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        commandTimeoutRefs.current = [];

        // console.log("clearCommandTimeout is end");
        // console.log("commandTimeoutRefs.current", commandTimeoutRefs.current);
    };

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

    // handle commands testing
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
        // clear command timeout to avoid set listening to continuous
        clearCommandTimeout()

        // Restart with the new mode
        SpeechRecognition.stopListening();
        // Small delay to ensure the stop action completes
        setTimeout(() => { SpeechRecognition.startListening({ continuous: true }) }, 50);

        setIsAwake(false); // Put the assistant back to sleep
        setCount(0)
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
})

export const SpeechContainerV2 = observer(({ mainstore }: { mainstore: MainStore }) => {
    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition,
    } = useSpeechRecognition();

    // manually document the speech status
    const [speechStatus, setSpeechStatus] = useState("off");

    // Automatically stop listening and process the transcript when recognition ends
    useEffect(() => {
        if (speechStatus == "on" && !listening) {
            console.log("Speech recognition session ended.");
            console.log("Final transcript:", transcript);

            // handle based on the final transcript
            mainstore.speech = transcript.trim()
            // handleCommand(transcript.trim());
            setSpeechStatus("off")
        }
    }, [listening]); // Run this effect when the `listening` state changes

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

    const startListening = () => {
        setSpeechStatus("on")
        console.log("Listening started...");
        resetTranscript(); // Clear any previous transcript
        SpeechRecognition.startListening({ continuous: false }); // Start listening (non-continuous mode)
    };

    const stopListening = () => {
        SpeechRecognition.stopListening(); // Stop listening manually
        console.log("Listening stopped.", transcript);
        handleCommand(transcript.trim()); // Process the final transcript
    };

    return (
        <div>
            {browserSupportsSpeechRecognition ? "" : <p>Your browser does not support speech recognition.</p>}
            <h1>Speech Command Interaction</h1>
            <p>Command: {transcript || "No command yet"}</p>
            <p>Status: {listening ? "Listening..." : "Not Listening"}</p>
            <button onClick={startListening}>Start Listening</button>
            <button onClick={stopListening} disabled={!listening}>
                Stop Listening
            </button>
        </div>
    );
})

export const SpeechContainer = observer(({ mainstore }: { mainstore: MainStore }) => {
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

    const render = () => {
        const { TextArea } = Input;

        return (
            <div className="speech-panel">
                {/* <Space> */}
                {/* <Input
                        prefix={<AudioOutlined />}
                        placeholder="Speech to interact"
                        value={mainstore.speech}
                        onChange={e => {
                            mainstore.speech = e.target.value;
                            mainstore.status = InteractStatus.SpeechOn
                        }}
                    /> */}
                <AudioOutlined />
                <TextArea
                    placeholder="Speech to interact"
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    autoSize
                    style={{ width: "75%" }}
                />
                <Button onClick={handleUserInput}>Send</Button>
                {/* <TextArea
                    placeholder="Speech to interact"
                    value={mainstore.speech_now.text}
                    onChange={e => {
                        let message: Message = { sender: "User", text: e.target.value }
                        mainstore.speech_now = message;
                        mainstore.speech_list.push(message)
                        mainstore.status = InteractStatus.SpeechOn
                    }}
                    autoSize
                    style={{ width: "85%" }}
                /> */}
                <Button onClick={async () => {
                    // take the current typed in as command for LLM 
                    handleUserInput()

                    // call LLM to handle
                    let command = toJS(mainstore.speech_now.text)
                    let currentSpec = toJS(mainstore.specification_now)

                    let result = await updateSpec(command, currentSpec)
                    let updatedSpec = result['spec']
                    console.log("result", result);

                    mainstore.specification_list.push(currentSpec)
                    mainstore.specification_now = updatedSpec

                    mainstore.update_flag = !mainstore.update_flag
                }}>Send to AI</Button>
                {/* </Space> */}
            </div>
        );
    };

    return render();
});
