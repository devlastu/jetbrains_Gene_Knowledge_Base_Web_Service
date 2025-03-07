// Fetch plot data from the Flask backend
fetch('http://127.0.0.1:5000/plot_data')
.then(response => response.json())
.then(data => {
    // Function to map values to colors from the palette
    function getColor(value, min, max) {
        const colors = ['#872341', '#BE3144', '#E17564'];
        const range = max - min;
        const valueScaled = (value - min) / range; // Scale the value between 0 and 1
        const colorIndex = Math.min(Math.floor(valueScaled * (colors.length - 1)), colors.length - 1);
        return colors[colorIndex]; // Return the corresponding color from the palette
    }

    // Calculate min and max values for scaling
    const minValue = Math.min(...data.y); // You can change this to x, y, or z depending on your desired axis
    const maxValue = Math.max(...data.y);

    // Map each point to the corresponding color based on its value
    const colors = data.y.map(value => getColor(value, minValue, maxValue));

    // Extracting the data and applying color directly to the plot
    var trace1 = {
        x: data.x,
        y: data.y,
        z: data.z,
        mode: 'markers',
        marker: {
            size: 12,
            color: colors, // Apply the colors mapped to the values
            opacity: 0.8,
            line: { color: 'rgba(217, 217, 217, 0.14)', width: 0.5 }
        },
        type: 'scatter3d'
    };

    var trace2 = {
        x: data.x,
        y: data.y,
        z: data.z,
        mode: 'markers',
        marker: {
            color: colors, // Color for the second trace
            size: 12,
            symbol: 'circle',
            line: { color: 'rgb(204, 204, 204)', width: 1 },
            opacity: 0.8
        },
        type: 'scatter3d'
    };

    // Set up the layout with custom colors, background, and controls
    var layout = {
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
            xaxis_title: "Z Axis (Fixed 0)",
            yaxis_title: "Y Axis (-Log10 Adjusted P-Value)",
            zaxis_title: "X Axis (Log2 Fold Change)",
            camera: { eye: { x: 1, y: , z: 0.5 } }
        },
        paper_bgcolor: "#09122C", // Background color for the entire plot
        plot_bgcolor: "#09122C",  // Background color for the plotting area
        font: {
            color: "#FFFFFF"  // Font color for the axes and titles
        },
        dragmode: 'zoom',  // Allows zooming
        showlegend: false, // Disable the legend
        autosize: true,
        hovermode: 'closest',  // Shows hover information on closest points
        scene: {
            xaxis: { showgrid: false },  // Hides grid on X axis
            yaxis: { showgrid: false },  // Hides grid on Y axis
            zaxis: { showgrid: false },  // Hides grid on Z axis
        },
        sliders: {
            showActive: false,  // Hide slider controls
        }
    };

    // Plotting the data using Plotly
    Plotly.newPlot('myDiv', [trace1, trace2], layout);

})
.catch(error => {
    console.error("Error fetching plot data:", error);
});
