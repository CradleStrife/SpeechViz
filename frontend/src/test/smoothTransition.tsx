import React, { useEffect, useRef, useState } from "react";
import embed, { VisualizationSpec, EmbedOptions } from "vega-embed";
import * as vega from 'vega'; // Import vega for changeset functionality
import * as _ from 'lodash';

// data: re-render
// scale: smooth
export const ScatterPlotV3: React.FC = () => {
    // Reference to the Vega view
    const vegaViewRef = useRef<any>(null);

    // State to keep track of the scale (xDomain)
    const [xDomain, setXDomain] = useState<[number, number]>([0, 50]);

    // Initial data for the scatter plot
    const data = [
        { x: 8, y: 18, category: "A", size: 25 },
        { x: 12, y: 22, category: "A", size: 40 },
        { x: 15, y: 25, category: "B", size: 50 },
        { x: 18, y: 28, category: "A", size: 55 },
        { x: 20, y: 19, category: "C", size: 40 },
        { x: 22, y: 36, category: "C", size: 75 },
        { x: 25, y: 25, category: "B", size: 60 },
        { x: 30, y: 35, category: "A", size: 75 },
        { x: 35, y: 40, category: "C", size: 90 },
        { x: 40, y: 45, category: "B", size: 100 },
    ];

    // Vega-Lite specification
    const spec: VisualizationSpec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: {
            "values":
                [
                    { x: 8, y: 18, category: "A", size: 25 },
                    { x: 12, y: 22, category: "A", size: 40 },
                    { x: 15, y: 25, category: "B", size: 50 },
                    { x: 18, y: 28, category: "A", size: 55 },
                    { x: 20, y: 19, category: "C", size: 40 },
                    { x: 22, y: 36, category: "C", size: 75 },
                    { x: 25, y: 25, category: "B", size: 60 },
                    { x: 30, y: 35, category: "A", size: 75 },
                    { x: 35, y: 40, category: "C", size: 90 },
                    { x: 40, y: 45, category: "B", size: 100 },
                ]
        }, // Placeholder for programmatic data updates
        mark: "point",
        encoding: {
            x: {
                field: "x",
                type: "quantitative",
                scale: { domain: { param: "xDomain" } }, // Bind scale to the xDomain parameter
                // axis: { title: "X-Axis" },
            },
            y: {
                field: "y",
                type: "quantitative",
                // axis: { title: "Y-Axis" },
            },
            color: { field: "category", type: "nominal", legend: { title: "Category" } },
            //   size: { field: "size", type: "quantitative", legend: { title: "Size" } },
        },
        params: [
            {
                name: "xDomain", // Parameter to control the x-axis domain
                value: [0, 50], // Default domain
            },
        ],
    };

    // Embed the Vega-Lite chart
    useEffect(() => {
        const newData = _.sampleSize(data, 5);
        spec.data['values'] = newData

        console.log("run 1");
        const options: EmbedOptions = { actions: false }; // Disable chart controls
        embed("#chart", spec, options).then(({ view }) => {
            vegaViewRef.current = view; // Save the Vega view reference
        });

        return () => {
            console.log("run 2");
            vegaViewRef.current = null; // Cleanup on unmount
        };
    }, [xDomain]);

    // // Update the xDomain parameter in Vega when it changes
    // useEffect(() => {
    //     if (vegaViewRef.current) {
    //         console.log("xDomain", xDomain);
    //         vegaViewRef.current.signal("xDomain", xDomain).run(); // Update the parameter
    //     }
    // }, [xDomain]);

    // // Update the data without re-rendering
    // useEffect(() => {
    //     if (vegaViewRef.current) {
    //         const newData = _.sampleSize(data, 5);;
    //         console.log("newData", newData);

    //         // Update the chart with new data
    //         vegaViewRef.current.change(
    //             "table",
    //             vega.changeset().remove(() => true).insert(newData) // Remove old data and insert new data
    //         ).run();
    //     }
    // }, [xDomain]);

    useEffect(() => {
        if (vegaViewRef.current) {
            const newData = _.sampleSize(data, 5);;
            console.log("newData", newData);

            // Update the chart with new data
            vegaViewRef.current.change(
                "table",
                vega.changeset().remove(() => true).insert(newData) // Remove old data and insert new data
            ).run();
        }
    }, [xDomain]);


    // Handlers for updating the xDomain
    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const min = Number(e.target.value) || 0;
        setXDomain([min, xDomain[1]]);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const max = Number(e.target.value) || 50;
        setXDomain([xDomain[0], max]);
    };

    return (
        <div>
            {/* Chart container */}
            <div id="chart"></div>

            {/* Controls for updating the domain */}
            <div style={{ marginTop: "20px" }}>
                <label>
                    X Min:
                    <input
                        type="number"
                        value={xDomain[0]}
                        onChange={handleMinChange}
                        placeholder="Set X Min..."
                    />
                </label>
                <label style={{ marginLeft: "10px" }}>
                    X Max:
                    <input
                        type="number"
                        value={xDomain[1]}
                        onChange={handleMaxChange}
                        placeholder="Set X Max..."
                    />
                </label>
            </div>
        </div>
    );
};

// refer to ScatterPlot for simper and direct examples to filter data and adjust domains
export const ScatterPlotV2: React.FC = () => {
    // Reference to the Vega view
    const vegaViewRef = useRef<any>(null);

    // State for xDomain and highlight category
    const [xDomain, setXDomain] = useState<[number, number]>([0, 50]);
    const [highlightCategory, setHighlightCategory] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<string>("y"); // Attribute to sort by
    const [sortOrder, setSortOrder] = useState<string>("descending"); // Sort direction

    // Initial data for the scatter plot
    const data = [
        { x: 8, y: 18, category: "A", size: 25 },
        { x: 12, y: 22, category: "A", size: 40 },
        { x: 15, y: 25, category: "B", size: 50 },
        { x: 18, y: 28, category: "A", size: 55 },
        { x: 20, y: 19, category: "C", size: 40 },
        { x: 22, y: 36, category: "C", size: 75 },
        { x: 25, y: 25, category: "B", size: 60 },
        { x: 30, y: 35, category: "A", size: 75 },
        { x: 35, y: 40, category: "C", size: 90 },
        { x: 40, y: 45, category: "B", size: 100 },
    ];

    // Vega-Lite specification
    const spec: VisualizationSpec = {
        data: { name: "table" }, // Placeholder for programmatic data updates
        mark: { type: "point", tooltip: true },
        encoding: {
            x: {
                field: "x",
                type: "quantitative",
                scale: { domain: { param: "xDomain" } },
                axis: { title: "X-Axis" },
            },
            y: {
                field: "y",
                type: "quantitative",
                axis: { title: "Y-Axis" },
            },
            color: {
                field: "category",
                type: "nominal",
                legend: { title: "Category" },
                condition: {
                    test: `datum.category === highlightCategory`,
                    value: "red", // Highlighted color
                },
            },
            //   size: { field: "size", type: "quantitative", legend: { title: "Size" } },
            opacity: {
                condition: {
                    test: `datum.category === highlightCategory`,
                    value: 1, // Fully opaque for highlighted items
                },
                value: 0.5, // Semi-transparent for others
            },
            order: { field: sortBy, type: "quantitative" }, // Enable sorting
        },
        params: [
            {
                name: "xDomain", // Parameter to control the x-axis domain
                value: [0, 50], // Default domain
            },
            {
                name: "highlightCategory", // Parameter for highlighting
                value: null,
            },
            {
                name: "sortParams", // Parameter for sorting
                value: { field: "y", order: "descending" }, // Initial sorting config
            },
        ],
    };

    // Embed the Vega-Lite chart
    useEffect(() => {
        const options: EmbedOptions = { actions: false }; // Disable chart controls
        embed("#chart", spec, options).then(({ view }) => {
            vegaViewRef.current = view; // Save the Vega view reference

            // Insert initial data
            view.change("table", vega.changeset().insert(data)).run();
        });

        return () => {
            vegaViewRef.current = null; // Cleanup on unmount
        };
    }, []);

    // Highlight data points dynamically
    useEffect(() => {
        if (vegaViewRef.current) {
            vegaViewRef.current.signal("highlightCategory", highlightCategory).run(); // Update highlight
        }
    }, [highlightCategory]);

    // Update sorting dynamically
    // Update sorting dynamically and log the updated spec
    useEffect(() => {
        if (vegaViewRef.current) {
            const sortConfig = {
                field: sortBy,
                order: sortOrder,
            };
            vegaViewRef.current.signal("sortParams", sortConfig).run(); // Update sort

            // Retrieve and log the updated spec/state
            const updatedState = vegaViewRef.current.getState();
            console.log("Updated Vega-Lite Spec:", updatedState);
        }
    }, [sortBy, sortOrder]);

    // Update the xDomain parameter in Vega when it changes
    useEffect(() => {
        if (vegaViewRef.current) {
            vegaViewRef.current.signal("xDomain", xDomain).run(); // Update the parameter
        }
    }, [xDomain]);

    // Handlers for updating the xDomain
    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const min = Number(e.target.value) || 0;
        setXDomain([min, xDomain[1]]);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const max = Number(e.target.value) || 50;
        setXDomain([xDomain[0], max]);
    };

    // Handlers for highlighting and sorting
    const handleHighlight = (category: string) => {
        setHighlightCategory(category === highlightCategory ? null : category);
    };

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSortBy(e.target.value);
    };

    const toggleSortOrder = () => {
        setSortOrder(sortOrder === "ascending" ? "descending" : "ascending");
    };

    return (
        <div>
            {/* Chart container */}
            <div id="chart"></div>

            {/* Controls for updating the domain */}
            <div style={{ marginTop: "20px" }}>
                <label>
                    X Min:
                    <input
                        type="number"
                        value={xDomain[0]}
                        onChange={handleMinChange}
                        placeholder="Set X Min..."
                    />
                </label>
                <label style={{ marginLeft: "10px" }}>
                    X Max:
                    <input
                        type="number"
                        value={xDomain[1]}
                        onChange={handleMaxChange}
                        placeholder="Set X Max..."
                    />
                </label>
            </div>

            {/* Controls for highlighting and sorting */}
            <div style={{ marginTop: "20px" }}>
                <button onClick={() => handleHighlight("A")}>Highlight A</button>
                <button onClick={() => handleHighlight("B")}>Highlight B</button>
                <button onClick={() => handleHighlight("C")}>Highlight C</button>
            </div>

            <div style={{ marginTop: "15px" }}>
                <span style={{ fontWeight: "bold", marginRight: "10px" }}>Sort By:</span>
                <select
                    onChange={handleSortChange}
                    value={sortBy}
                    style={{ padding: "5px", marginRight: "10px" }}
                >
                    <option value="category">Category</option>
                    <option value="y">Value</option>
                    <option value="size">Size</option>
                </select>

                <button onClick={toggleSortOrder} style={{ padding: "5px 10px" }}>
                    {sortOrder === "ascending" ? "⬆️ Ascending" : "⬇️ Descending"}
                </button>
            </div>
        </div>
    );
};

export const ScatterPlot: React.FC = () => {
    // Reference to the Vega view
    const vegaViewRef = useRef<any>(null);

    // State to keep track of the scale (xDomain)
    const [xDomain, setXDomain] = useState<[number, number]>([0, 50]);

    // Initial data for the scatter plot
    const data = [
        { x: 8, y: 18, category: "A", size: 25 },
        { x: 12, y: 22, category: "A", size: 40 },
        { x: 15, y: 25, category: "B", size: 50 },
        { x: 18, y: 28, category: "A", size: 55 },
        { x: 20, y: 19, category: "C", size: 40 },
        { x: 22, y: 36, category: "C", size: 75 },
        { x: 25, y: 25, category: "B", size: 60 },
        { x: 30, y: 35, category: "A", size: 75 },
        { x: 35, y: 40, category: "C", size: 90 },
        { x: 40, y: 45, category: "B", size: 100 },
    ];

    // Vega-Lite specification
    const spec: VisualizationSpec = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: { name: "table" }, // Placeholder for programmatic data updates
        mark: "point",
        encoding: {
            x: {
                field: "x",
                type: "quantitative",
                scale: { domain: { param: "xDomain" } }, // Bind scale to the xDomain parameter
                // axis: { title: "X-Axis" },
            },
            y: {
                field: "y",
                type: "quantitative",
                // axis: { title: "Y-Axis" },
            },
            color: { field: "category", type: "nominal", legend: { title: "Category" } },
            //   size: { field: "size", type: "quantitative", legend: { title: "Size" } },
        },
        params: [
            {
                name: "xDomain", // Parameter to control the x-axis domain
                value: [0, 50], // Default domain
            },
        ],
    };

    // Embed the Vega-Lite chart
    useEffect(() => {
        console.log("run 1");
        const options: EmbedOptions = { actions: false }; // Disable chart controls
        embed("#chart", spec, options).then(({ view }) => {
            vegaViewRef.current = view; // Save the Vega view reference

            // Insert initial data
            view.change("table", vega.changeset().insert(data)).run();
        });

        return () => {
            console.log("run 2");
            vegaViewRef.current = null; // Cleanup on unmount
        };
    }, []);

    // Update the xDomain parameter in Vega when it changes
    useEffect(() => {
        if (vegaViewRef.current) {
            console.log("xDomain", xDomain);
            vegaViewRef.current.signal("xDomain", xDomain).run(); // Update the parameter
        }
    }, [xDomain]);

    // Update the data without re-rendering
    useEffect(() => {
        if (vegaViewRef.current) {
            const newData = _.sampleSize(data, 5);;
            console.log("newData", newData);

            // Update the chart with new data
            vegaViewRef.current.change(
                "table",
                vega.changeset().remove(() => true).insert(newData) // Remove old data and insert new data
            ).run();
        }
    }, [xDomain]);

    useEffect(() => {
        if (vegaViewRef.current) {
            const newData = _.sampleSize(data, 5);;
            console.log("newData", newData);

            // Update the chart with new data
            vegaViewRef.current.change(
                "table",
                vega.changeset().remove(() => true).insert(newData) // Remove old data and insert new data
            ).run();
        }
    }, [xDomain]);


    // Handlers for updating the xDomain
    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const min = Number(e.target.value) || 0;
        setXDomain([min, xDomain[1]]);
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const max = Number(e.target.value) || 50;
        setXDomain([xDomain[0], max]);
    };

    return (
        <div>
            {/* Chart container */}
            <div id="chart"></div>

            {/* Controls for updating the domain */}
            <div style={{ marginTop: "20px" }}>
                <label>
                    X Min:
                    <input
                        type="number"
                        value={xDomain[0]}
                        onChange={handleMinChange}
                        placeholder="Set X Min..."
                    />
                </label>
                <label style={{ marginLeft: "10px" }}>
                    X Max:
                    <input
                        type="number"
                        value={xDomain[1]}
                        onChange={handleMaxChange}
                        placeholder="Set X Max..."
                    />
                </label>
            </div>
        </div>
    );
};