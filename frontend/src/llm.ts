import OpenAI from "openai";
import { atomicActionDefs, ChartType } from "./util.tsx";
import * as _ from 'lodash';

const GPT35Turbo = 'gpt-3.5-turbo'
const GPT4oMini = 'gpt-4o-mini'
const GPT4o = 'gpt-4o'
const DeepSeekChat = 'deepseek-chat'
const DeepSeekReasoner = 'deepseek-reasoner'
const LLAMA8B = 'meta-llama-3.1-8b-instruct:2'

const ChosenModel = GPT4oMini
const openai = new OpenAI({
    // baseURL: "https://api.vveai.com/v1",
    baseURL: "https://api.v3.cm/v1",
    apiKey: "sk-5odnK97xBrNHkuqA6d2b78F0E1714b6bB7F44c67BdCd1bBb",
    dangerouslyAllowBrowser: true
});

// call local model
// const openai = new OpenAI({
//     baseURL: "http://127.0.0.1:1234/v1",
//     apiKey: "sk-5odnK97xBrNHkuqA6d2b78F0E1714b6bB7F44c67BdCd1bBb",
//     dangerouslyAllowBrowser: true
// });

async function callLLM(prompt) {
    const startTime = performance.now();

    let chat_completion = await openai.chat.completions.create({
        model: ChosenModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
    });

    let result = chat_completion.choices[0].message?.content || ""
    let state = chat_completion.choices[0].finish_reason
    console.log("result", JSON.parse(result));
    // console.log("state", state);

    if (state != "stop") {
        console.log("error (state): ", state);
    } else if (!isValidJson(result)) {
        console.log("error (not json format): ", result);
    }

    const endTime = performance.now();
    console.log(`Duration: ${((endTime - startTime) / 1000).toFixed(2)} s`);

    return result == "" ? result : JSON.parse(result)
}

function isValidJson(jsonString) {
    try {
        JSON.parse(jsonString); // Attempt to parse the string
        return true; // If no error is thrown, it's valid JSON
    } catch (error) {
        return false; // If an error is thrown, it's invalid JSON
    }
}

// -------------------------SpeechViz-------------------------
export async function enhanceDataLLM(spec) {
    const prompt = `
    You will be given a vega-lite chart spec using v5 schema, follow the requirements below to enhance the data items in the spec. 

    "Your task":
    1. enhance the data items with color, shape fields if there are relevant encodings in the spec.
    Please be aware, every data item has an id field, which is its unique identifier. 
    2. if the distilled color is hard to describe, assign a relevant name for the color, making it easy for users to refer to. 
    3. map the color and shape to relevant data value and data items (using their ids), e.g., {"color": ..., "value": ..., "ids": [...]}
    4. Return results in JSON format: {"data": [...], "colorMapping": [...], "shapeMapping": [...]}.

    "Chart Spec": 
    ${JSON.stringify(spec)}
    `
    console.log("prompt", prompt);

    let result = await callLLM(prompt)
    return result
}

export async function mapAndDistillSpeech2TaskSV(
    transcript: string,
    context: string,
    attr2Encoding,
    dataItems,
    seletedDataItems, // for T1
    chartType: string, // for T2
    currentDomain, // for T2
    initialDomain, // for T2
) {
    const prompt = `
    You are an assistant that helps users do tasks in visualizations based on users' speech command.

    "Your task":
    1. categorize the command into 5 types, i.e., T1 to T5, and reveal it in the type field of the output.
    T1: select, filter, highlight, show details.
    T2: zoom, pan.
    T3: aggregate, sort.
    T4: show grids, show labels.
    T5: undo, redo, reset, reverse tasks of T1-4 (e.g., clear select, clear filter, hide details, unhighlight, zoom out, pan out, remove aggregation, remove sort, hide grids, hide labels)

    2. if the task belongs to types 1, 2, 3 or 4. follow the requirements below to distill relevant information and respond. 
    if the task belongs to type 5, categorize the utterance into specific task in T5 using the task field, and return the result in JSON format: {"type": "", "task":"" }.

    "Data columns and their types":
    ${_.join(_.map(attr2Encoding, (item) => `${item.field}: ${item.type}`), "\n\t")}

    "Data encoding (map between visual encodings and data attributes)":
    ${_.join(_.map(attr2Encoding, (item) => `${item.channel}: ${item.field}`), "\n\t")}

    "Data items":
    ${_.join(_.map(dataItems, (item) => JSON.stringify(item)), ", ")}

    "Requirements for types of tasks":

    """T1: ${T1Prompt(seletedDataItems)}"""

    """T2: ${T2Prompt(chartType, currentDomain, initialDomain)}"""

    """T3: ${T3Prompt()}"""

    Now, process the user command:
    ${transcript}

    ${context == "" ?
            "" : " More context for the command: \n" + context}
    `;
    console.log("prompt", prompt);

    let result = await callLLM(prompt)
    return result
}

// type 1: select/filter/highlight/show details: selection of data items
// FIXME: selected data items can be put into more context to simplify the prompt design
function T1PromptV_1(seletedDataItems: string[]) {
    const prompt = `
    Your task:
    1. Identify all the relevant data items based on user's command. 
    if the command is ambiguous(e.g., approximate direction(e.g., top, right, center) or approximate value, no directly matching color or shape),
    attempt to complete the task,
    mark the ambiguity from aspects of "Position", "DataValue", "Color", "Shape", "Other",        and provide a clear, brief response to ask for clarification.

    as for ambiguityDetail, 
    if the ambiguty falls into "Position",
    map the utterance to Top, Right, Bottom, Left, Center, Top Right, Top Left, Bottom Left, Bottom Right.
    if the ambiguty falls into "DataValue",
    map the utterance to XBigger, XSmaller, XMiddle, YBigger, YSmaller, YMiddle,
    please be aware X and Y refers to axis.
    If the ambiguty falls into "Color" or "Shape", 
    try to find the most relevant one from the available colors or shapes,
    store it to the ambiguityDetail field,
    and inform users to clarify based on the available colors or shapes.
    2. Please be aware, every data item has an id field, which is its unique identifier. 
    color related utterance refers to the "color" attribute,
    shape related utterance refers to the "shape" attribute,
    position related utterance refers to attributes "xCoord" and "yCoord". 
    Data value related utterance refers to data attributes. 
       
    Please be aware, do not mention attributes "id", "color", "shape", "xCoord", "yCoord" explicitly in the response.
    3. categorize the utterance into "select", "inclusive filter", "exclusive filter", "show details", and reveal it in the task field in the output.
    4. if there are number labels in the utterance, distill and put them into the label field of the output using string format.
    5. Return results in JSON format: { "type": "", "task": "", "ids": [...], "ambiguity": [...], "ambiguityDetail": [...], "response": "", "label": [...] }.

    Selected data items' ids: 
    ${JSON.stringify(seletedDataItems)}
    `

    return prompt
}

// FIXME: explain the attributes for better location, and simplify the prompt
function T1Prompt(seletedDataItems: string[]) {
    const prompt = `
    Your task:
    1. Identify all the relevant data items based on user's command, and put their ids in the ids field of the output. 
    if the command is ambiguous(e.g., approximate direction(e.g., top, right, center) or approximate value, no matching color or shape),
    attempt to complete the task,
    and provide a clear, brief response to ask for clarification.

    If there is no matching color or shape, 
    try to find the most relevant one from the available colors or shapes,
    and inform users to clarify based on the available colors or shapes.

    2. Please be aware, every data item has an id field, which is its unique identifier. 
    color related utterance refers to the "color" attribute,
    shape related utterance refers to the "shape" attribute,
    position related utterance refers to attributes "xCoord" and "yCoord". 
    Data value related utterance refers to data attributes. 
    Do not mention attributes "id", "color", "shape", "xCoord", "yCoord" explicitly in the response.
    3. if there are labels in the utterance, distill the label, and put it into the label field in the output using string format.
    4. categorize the utterance into "select", "inclusive filter", "exclusive filter", "show details", and reveal it in the task field in the output.
    5. Return results in JSON format: { "type": "", "task": "", "ids": [...], "response": "", "label": [...] }.

    Selected data items' ids: 
    ${JSON.stringify(seletedDataItems)}
    `

    return prompt
}

// FIXME: may include the explanation of the domain for other chart types
function T2Prompt(chartType: string, currentDomain, initialDomain) {
    const promptScatter = `
    "Your task":
    1. compute the new xDomain (for x axis) and yDomain (for y axis), based on the current domain of the ${chartType} chart, and the initial domain.
    2. if there are labels in the utterance, distill the label, and put it into the label field in the output using string format.
    3. Return results in JSON format: {"type": "", "task": "", "domain": {"xDomain": [...], "yDomain": [...] }, "label": [...]}.

    current domain:
    ${JSON.stringify(currentDomain)}

    initial domain:
    ${JSON.stringify(initialDomain)}
    `

    let prompt
    if (chartType == ChartType.Scatter) {
        prompt = promptScatter
    }

    return prompt
}

function T3Prompt() {
    const prompt = `
    Your task:
    1. categorize the utterance into "aggregate", "sort", and reveal it in the task field of the output.
    2. distill columns and other relevant parameter based on the identified task, e.g., aggregation function, sort order.
    if the command is ambiguous, attempt to complete the task, mark the ambiguity from aspects of lack of "Column", "Parameter", "Other", and provide a brief response for clarification.
    3. map the identified parameter to vegalite V5 accepted.
    4. check if the task is valid to operate, for example, proper data type, aggregation function, sort order, mark it's status with boolean in the output.
    5. Return results in JSON format: { "type": "", "task": "", params: [{ "column": "", parameter: "", "ambiguity": "", "valid": "" }], "response": "" }.
    `

    return prompt
}

// -------------------------speech 2 interact-------------------------
export async function mapAndDistillSpeech2Task(transcript, task) {
    const prompt = `
    I am creating a tool to support natural language based interaction with data visualization.
    You are a smart assistant that maps user commands in natural language to predefined tasks and distill relevant parameters from the commands. 
    
    Below is a list of available tasks with their definitions, required parameters, and their expected output format:
    ${Object.entries(atomicActionDefs)
            .map(([key, item], index) => {
                if (typeof (item) === "object" && item != null) {
                    return `
    ${index + 1}. ${key}.
    Definition: ${item.def}
    Required Parameters: ${item.params}
    Example: 
    User command: ${item.example.command}
    Output format: ${JSON.stringify(item.example.format)}`
                }
            }).join("\n")
        }

    The user will provide a command in natural language.Your task is to:
    1. Identify the most relevant task based on the task definitions.if the task(${task}) is not null, skip this step.
    2. Extract parameters based on the required parameters of the task.
    3. Return a JSON object with the task name and parameters following the example of the task.

    Now, process this user command:
    "${transcript}"
    `;
    console.log("prompt", prompt);

    let result = await callLLM(prompt)
    return result
}

export async function selectBySemanticLLM(transcript, data) {
    const prompt = `
    You are a smart assistant that helps user select data items.

    The user will provide a command in natural language.Your task is to:
    1. Identify the most relevant data items based on user's commands and provided data items.
    2. Return a list of items using their ids using a json object, i.e., { "ids": [...] }.

    Data items: every data item has an id field, which is its unique identifier.
    "${data}"

    Now, process this user command:
    "${transcript}"
    `;
    console.log("prompt", prompt);

    let result = await callLLM(prompt)
    return result
}

// test llm in js
export const testAPI = async () => {
    const chat_completion = await openai.chat.completions.create({
        model: ChosenModel,
        messages: [
            { role: "system", content: "You are a helpful assistant." },
            {
                role: "user",
                content: "use vegalite to create a scatter plot, and return the specification.",
            },
        ],
    });

    let result = chat_completion.choices[0].message.content
    let state = chat_completion.choices[0].finish_reason

    console.log("testAPI", result, state);
}

// test lls to adjust the chart specification
export const updateSpec = async (command, spec) => {
    console.log("LLM API: updateSpec");

    let prompt = `
    You will be provided with a vega - lite specification, and my command.
    
    Use the following step - by - step instructions to respond:
    Step1: Follow my command to update the specification.

    Notes:
    1. provide your output in JSON format, i.e., { "spec": ...}

    command: ${command}
    specification: ${JSON.stringify(spec)}
    `
    console.log("prompt", prompt);

    let chat_completion = await openai.chat.completions.create({
        model: ChosenModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
    });

    let result = chat_completion.choices[0].message?.content || ""
    let state = chat_completion.choices[0].finish_reason
    console.log("result", JSON.parse(result));
    // console.log("state", state);

    if (state != "stop") {
        console.log("error (state): ", state);
    } else if (!isValidJson(result)) {
        console.log("error (not json format): ", result);
    }

    return result == "" ? result : JSON.parse(result)
}

// the below may be deprecated
export async function mapSpeechToFunction(transcript) {
    const prompt = `
    You are a smart assistant that maps user commands to predefined functions.Below is a list of available functions and their descriptions:
    ${Object.entries(atomicActionDefs)
            .map(([key, item]) => `- ${key}: ${item.def}`)
            .join("\n\t")
        }

    The user will provide a command in natural language.Your task is to:
    1. Identify the most relevant function.
    2. Extract any parameters needed for the function (e.g., label in numbers).
    3. Return a JSON object with the function name and parameters.

    Example:
    User command: "Select"
    Response: { "function": "select", "params": { "labels": [] } }
    
    User command: "Zoom into 3 and 4"
    Response: { "function": "zoom", "params": { "labels": ['3', '4'] } }

    User command: "Reset everything"
    Response: { "function": "reset", "params": { } }

    Now, process this user command:
    "${transcript}"
    `;
    console.log("prompt", prompt);

    let result = await callLLM(prompt)
    return result
}

export async function identifySelectType(transcript) {
    const prompt = `
    You are a smart assistant that maps user commands to types of selection.

    The user will provide a command in natural language.Your task is to:
    1. Identify the most relevant type.
    2. if the command is similar to "select" and "select 1"(1 is a number label), mark the command type "Grid";
    if the command is similar to "remove", mark type "Remove";
    if others, mark type "Semantic".
    3. Return the identified type using json object, e.g., { "type": "Grid" }, { "type": "Semantic" }.

    Now, process this user command:
    "${transcript}"
    `;
    console.log("prompt", prompt);

    let result = await callLLM(prompt)
    return result
}
