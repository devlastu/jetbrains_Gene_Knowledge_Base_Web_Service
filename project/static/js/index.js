let initialCameraPosition = null;
let isDragging = false; // Flag za praćenje draga

// Funkcija za praćenje rotacije
function trackCameraRotation(currentCamera) {
    if (!initialCameraPosition) return;

    // Izračunaj razliku između trenutne i početne pozicije kamere
    const deltaEye = {
        x: currentCamera.eye.x - initialCameraPosition.eye.x,
        y: currentCamera.eye.y - initialCameraPosition.eye.y,
        z: currentCamera.eye.z - initialCameraPosition.eye.z
    };

    const deltaUp = {
        x: currentCamera.up.x - initialCameraPosition.up.x,
        y: currentCamera.up.y - initialCameraPosition.up.y,
        z: currentCamera.up.z - initialCameraPosition.up.z
    };

    // Izračunaj ugao rotacije oko X, Y i Z osa
    const rotationX = Math.atan2(deltaEye.y, deltaEye.z);
    const rotationY = Math.atan2(deltaEye.x, deltaEye.z);
    const rotationZ = Math.atan2(deltaUp.x, deltaUp.y);

    console.log("Rotation around X axis:", rotationX);
    console.log("Rotation around Y axis:", rotationY);
    console.log("Rotation around Z axis:", rotationZ);
}

// Funkcija za dohvatanje podataka
function fetchData() {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'block';

    const cachedData = sessionStorage.getItem('plotData');
    if (cachedData) {
        console.log('Loading data from cache');
        return Promise.resolve(JSON.parse(cachedData));
    }

    return fetch('http://127.0.0.1:5000/plot_data')
        .then(response => response.json())
        .then(data => {
            sessionStorage.setItem('plotData', JSON.stringify(data));
            console.log('Fetched data:', data);
            return data;
        })
        .catch(error => {
            console.error("Error fetching plot data:", error);
            throw error;
        });
}

function fetchProteinConcentrationData(geneName) {
    return fetch(`http://127.0.0.1:5000/protein_concentration_data?geneName=${geneName}`)
        .then(response => response.json())
        .then(data => {
            // Assuming the response contains the data for young and old donors
            return {
                young: data.youngDonors,
                old: data.oldDonors,
                additionalInfo: data.additionalInfo,
            };
            })
        .catch(error => {
            console.error('Error fetching protein concentration data:', error);
            throw error;
        });
}

// Funkcija za određivanje boje na osnovu vrednosti
function getColor(value, min, max) {

    const colors = ['#522258', '#8C3061', '#C63C51', '#d3904b', '#D97759FF', '#D99359FF', '#D3904BFF'];
    const mid = (min + max) / 2;
    const range1 = mid / 9 - min;
    const range2 = max - mid;

    let valueScaled;
    if (value <= mid) {
        valueScaled = (value - min) / range1;
    } else {
        valueScaled = (value - mid) / range2;
    }

    let colorIndex;
    if (value <= mid) {
        colorIndex = Math.min(Math.floor(valueScaled * (colors.length - 3)), colors.length - 3);
    } else {
        colorIndex = Math.min(Math.floor(valueScaled * 2), 2) + (colors.length - 2);
    }

    return colors[colorIndex];
}
// Funkcija za dobijanje granica podataka
function getDataBounds(data) {
    const xBounds = [Math.min(...data.z), Math.max(...data.z)];
    const yBounds = [Math.min(...data.x), Math.max(...data.x)];
    const zBounds = [Math.min(...data.y), Math.max(...data.y)];
    return [xBounds[1], yBounds[1], zBounds[1]];
}

// Funkcija za kreiranje 3D plot-a
function createPlot(data) {
    const minValue = Math.min(...data.y);
    const maxValue = Math.max(...data.y);
    const colors = data.y.map(value => getColor(value, minValue, maxValue));

    const trace = {
        x: data.z,
        y: data.x,
        z: data.y,
        mode: 'markers',
        marker: {
            size: 10,
            color: colors,
            opacity: 20,
            line: { color: 'rgba(217, 217, 217, 0)', width: 0}
        },
        customdata: data.geneNames.map((gene, index) => ({ geneName: gene, dataIndex: index })),hovertemplate: 'X: %{x}<br>Y: %{y}<br>Z: %{z}<extra></extra>',
        type: 'scatter3d'
    };

    const layout = {
        width: window.innerWidth,
        height: window.innerHeight,
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
            xaxis: {
                title: "",
                showgrid: false,
                zeroline: false,
                showbackground: false,
                showticklabels: false
            },
            yaxis: {
                title: "",
                showgrid: false,
                zeroline: false,
                showbackground: false,
                showticklabels: false
            },
            zaxis: {
                title: "",
                showgrid: false,
                zeroline: false,
                showbackground: false,
                showticklabels: false
            },
            aspectmode: 'manual',
            aspectratio: { x: 16, y: 40, z: 40 },
            camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } } // Početna pozicija kamere
        },
        paper_bgcolor: "#232323",
        plot_bgcolor: "#232323FF",
        font: { color: "#232323FF" },
        dragmode: 'orbit', // Omogućava rotaciju na drag
        showlegend: false,
        hovermode: 'closest'
    };

    // Spremi početnu poziciju kamere
    let initialCameraPosition = {
        eye: { x: 1.5, y: 1.5, z: 1.5 },
        center: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 }
    };

    // Ubrzaj scroll zoom pomoću wheel događaja
    let zoomFactor = 1.2; // Faktor koji kontroliše brzinu zoom-a

    document.getElementById('myDiv').onwheel = function(event) {
        if (event.deltaY > 0) {
            // Zoom out (smanjivanje)
            zoomFactor = 1.5; // Ubrzaj zoom out
        } else {
            // Zoom in (uvećanje)
            zoomFactor = 0.7; // Ubrzaj zoom in
        }

        // Promeni poziciju kamere na osnovu brzine zoom-a
        initialCameraPosition.eye.x *= zoomFactor;
        initialCameraPosition.eye.y *= zoomFactor;
        initialCameraPosition.eye.z *= zoomFactor;

        // Ažuriraj kameru sa novim zoom faktorom
        Plotly.relayout('myDiv', {
            'scene.camera.eye': initialCameraPosition.eye
        });
    };

    // Kreiraj plot
    Plotly.newPlot('myDiv', [trace], layout).then(function() {
        // Sakrij loader kad je plot kreiran
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';

        // Dodaj event listener za praćenje draga
        const plotElement = document.getElementById('myDiv');

        plotElement.on('plotly_relayout', function(eventData) {
            console.log("relayout done");
        });

        plotElement.on('plotly_relayout', function(eventData) {
            if (eventData['scene.camera']) {
                const currentCamera = eventData['scene.camera'];
                // console.log("Camera position changed:", currentCamera);

                // Proveri da li je kamera pomerena u odnosu na početnu poziciju
                if (
                    Math.abs(currentCamera.eye.x - initialCameraPosition.eye.x) > 0.001 ||
                    Math.abs(currentCamera.eye.y - initialCameraPosition.eye.y) > 0.001 ||
                    Math.abs(currentCamera.eye.z - initialCameraPosition.eye.z) > 0.001
                ) {
                    isDragging = true; // Zabilježi drag
                    // console.log("Drag detected.");
                } else {
                    isDragging = false; // Resetuj flag ako je kamera vraćena na početnu poziciju
                }
            }
        });

         plotElement.on('plotly_relayout', function(eventData) {
            if (eventData['scene.camera']) {
                const currentCamera = eventData['scene.camera'];
                // Izračunaj promenjenu udaljenost kamere
                const cameraDistance = Math.sqrt(
                    Math.pow(currentCamera.eye.x, 2) +
                    Math.pow(currentCamera.eye.y, 2) +
                    Math.pow(currentCamera.eye.z, 2)
                );

                // Menjaj veličinu tačaka na osnovu udaljenosti kamere
                const newSize = Math.max(5, Math.min(30, 7 * (4/cameraDistance)));
                console.log(newSize);
                console.log(cameraDistance);
                // Ažuriraj veličinu marker-a
                Plotly.restyle('myDiv', 'marker.size', Array(data.y.length).fill(newSize));
            }
        });

        // Handle click event on plot points
        plotElement.on('plotly_click', function(eventData) {
            // console.log(eventData);
            const proteinPlot = document.getElementById('protein-plot');
            proteinPlot.style.display = 'block';
            const geneName = eventData.points[0].customdata.geneName; // Extract geneName
            // console.log(geneName);
            fetchProteinConcentrationData(geneName)  // Fetch protein concentration data
                .then(proteinData => {
                    console.log(proteinData);
                    if (proteinData.young && proteinData.old) {
                        create2DPlot(proteinData);  // Create the 2D plot (volcano plot)

                        // Call fillInData to populate other gene information
                        fillInData(proteinData);
                    } else {
                        console.error("Error: Missing data for plotting.");
                    }
                })
                .catch(error => {
                    console.error("Error fetching protein concentration data:", error);
                });

            // Function to dynamically populate the HTML with protein data
            function fillInData(proteinData) {
                const infoContainer = document.getElementById("sidebar-content");

                // Populate protein concentration data
                infoContainer.innerHTML = `
                    <h3>Protein Information for Gene: ${proteinData.additionalInfo.EntrezGeneSymbol}</h3>
                    <p><strong>Gene Name:</strong> ${proteinData.additionalInfo.TargetFullName}</p>
                    <p><strong>Target:</strong> ${proteinData.additionalInfo.Target}</p>
                    <p><strong>Entrez Gene ID:</strong> ${proteinData.additionalInfo.EntrezGeneID}</p>
                    <p><strong>Organism:</strong> ${proteinData.additionalInfo.Organism}</p>
                    <p><strong>Units:</strong> ${proteinData.additionalInfo.Units}</p>
                    <p><strong>Type:</strong> ${proteinData.additionalInfo.Type}</p>
                    <p><strong>Dilution:</strong> ${proteinData.additionalInfo.Dilution}</p>
                    
                    <h4>Protein Concentration (Young vs Old Donors)</h4>
                    
                `;
            }

        });
    });
}


// Funkcija za kreiranje 2D plot-a
function create2DPlot(data) {
    // Osiguraj da podaci postoje
    if (!data.young || !data.old) {
        console.error("Error: Missing data for plotting.");
        return;
    }

    // Dodaj x vrednosti ako nisu pružene
    const xValues = data.x || [...Array(data.young.length).keys()];  // Koristi indekse ako x vrednosti nisu date

    // Razdvajanje na boje za mlade (young) i stare (old)
    const traceYoung = {
        x: xValues,
        y: data.young,
        mode: 'markers',
        marker: {
            size: 10,
            color: 'rgba(0, 123, 255, 1)', // Boja za mlade (light blue)
            opacity: 1,
            line: { color: 'rgba(217, 217, 217, 0.14)', width: 0.5 }
        },
        name: 'Young Donors',
        hovertemplate: 'X: %{x}<br>Y: %{y}<extra></extra>',
        type: 'scatter'
    };

    const traceOld = {
        x: xValues,
        y: data.old,
        mode: 'markers',
        marker: {
            size: 10,
            color: 'rgba(255, 99, 132, 1)', // Boja za stare (red)
            opacity: 0,
            line: { color: 'rgba(217, 217, 217, 0.14)', width: 0.5 }
        },
        name: 'Old Donors',
        hovertemplate: 'X: %{x}<br>Y: %{y}<extra></extra>',
        type: 'scatter'
    };

    // Dobijanje širine sidebar-a i postavljanje visine na željenu vrednost (30%)
    const sidebarWidth = document.getElementById('sidebar').offsetWidth; // Širina sidebar-a
    const plotHeight = window.innerHeight * 0.3; // Visina 30% od visine prozora

    // Layout za plot
    const layout = {
        width: sidebarWidth,  // Koristi širinu sidebar-a
        height: plotHeight,   // Koristi visinu 30% od prozora
        margin: { l: 20, r: 20, b: 40, t: 40 },  // Opcionalni margini
        paper_bgcolor: "#02091e",
        plot_bgcolor: "#02091e",
        font: { color: "#ffffff" },
        showlegend: true,
        hovermode: 'closest'
    };

    // Kreiraj plot u #protein-plot div-u
    Plotly.newPlot('protein-plot', [traceYoung, traceOld], layout);
}




// Funkcija za glatko resetovanje kamere
function smoothResetCameraPosition() {
    if (!initialCameraPosition) {
        console.error("Initial camera position is not set.");
        return;
    }
    const plotElement = document.getElementById('myDiv');

    if (!plotElement || !plotElement.layout || !plotElement.layout.scene) {
        console.error("Plot element or layout is not available.");
        return;
    }

    const currentCamera = plotElement.layout.scene.camera;
    console.log("Current camera before reset:", currentCamera);

    resetToInitialPosition();

    function resetToInitialPosition() {
        const currentCamera = plotElement.layout.scene.camera;
        const currentCenter = currentCamera.center || { x: 0, y: 0, z: 0 };
        const currentUp = currentCamera.up || { x: 0, y: 0, z: 1 };

        const duration = 1000; // Trajanje animacije u milisekundama
        const startTime = performance.now();

        function animateCamera(currentTime) {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / duration, 1);

            const newCamera = {
                eye: {
                    x: currentCamera.eye.x + (initialCameraPosition.eye.x - currentCamera.eye.x) * progress,
                    y: currentCamera.eye.y + (initialCameraPosition.eye.y - currentCamera.eye.y) * progress,
                    z: currentCamera.eye.z + (initialCameraPosition.eye.z - currentCamera.eye.z) * progress,
                },
                center: {
                    x: currentCenter.x + (initialCameraPosition.center.x - currentCenter.x) * progress,
                    y: currentCenter.y + (initialCameraPosition.center.y - currentCenter.y) * progress,
                    z: currentCenter.z + (initialCameraPosition.center.z - currentCenter.z) * progress,
                },
                up: {
                    x: currentUp.x + (initialCameraPosition.up.x - currentUp.x) * progress,
                    y: currentUp.y + (initialCameraPosition.up.y - currentUp.y) * progress,
                    z: currentUp.z + (initialCameraPosition.up.z - currentUp.z) * progress,
                }
            };

            Plotly.relayout(plotElement, {
                'scene.camera': newCamera
            });

            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        }

        requestAnimationFrame(animateCamera);
    }
}

// Poveži reset dugme sa funkcionalnošću
function setupResetButton() {
    const resetButton = document.getElementById('resetButton');
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            console.log("Reset button clicked."); // Ispisujemo klik na dugme
            smoothResetCameraPosition();  // Smoothly reset the camera position
        });
    }
}


// Glavna funkcija koja pokreće sve
function loadAndCreatePlot() {
    fetchData()
        .then(data => {
            createPlot(data);  // Kreiraj plot koristeći podatke
            // simulateClickOnCenter();
        })
        .catch(error => {
            console.error("Error in loading or creating plot:", error);
        });
}

document.addEventListener('DOMContentLoaded', function() {
    loadAndCreatePlot();
    setupResetButton();  // Poveži dugme sa funkcionalnošću
    trackCameraRotation();
    const plotElement = document.getElementById('myDiv');
    if (plotElement) {
        plotElement.onmousedown = function() {
            console.log("Mouse down on plot!");
            isDragging = true;
        };

        plotElement.onmouseup = function() {
            console.log("Mouse up on plot!");
            isDragging = false;
        };

        plotElement.onmousemove = function() {
            if (isDragging) {
                console.log("Dragging the plot!");
            }
        };
    }
})

window.addEventListener('resize', function() {
    Plotly.relayout('myDiv', {
        width: window.innerWidth,
        height: window.innerHeight
    });
});


