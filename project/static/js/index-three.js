import * as THREE from 'three';
import CameraControls from 'camera-controls';







CameraControls.install({ THREE: THREE });

let is3D = true; // Početno stanje je 3D
// Tooltip i osnovne promenljive
const tooltip = document.getElementById('myDiv');
const proteinPlot = document.getElementById('protein-plot');
let scene, camera, renderer, cameraControls, raycaster, mouse, points, mousePointer;
// Kreiraj novi tooltip element
const info = document.getElementById("elem-info");
// Omogućavanje CameraControls

let intersections = []
let selectedObject = null;
let originalColor = new THREE.Color();

// Global variable for initial camera and target positions
const initialCameraConfig = {
    position: new THREE.Vector3(0, 0, 150),
    target: new THREE.Vector3(0, 0, 0)
};

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    tooltip.appendChild(renderer.domElement);

    // Initialize the camera with the initial position
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.copy(initialCameraConfig.position);

    // Add listener to call onMouseMove every time the mouse moves in the browser window
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('click', onClick, false); // Dodajemo event listener za click

    console.log("Scene and camera initialized:", scene, camera); // Check initialization

    // Inicijalizacija CameraControls
    cameraControls = new CameraControls(camera, renderer.domElement);
    cameraControls.dollyToCursor = true;

    // Use the global variable to set the initial look-at configuration
    cameraControls.setLookAt(
        initialCameraConfig.position.x, initialCameraConfig.position.y, initialCameraConfig.position.z,
        initialCameraConfig.target.x, initialCameraConfig.target.y, initialCameraConfig.target.z
    );
    window.addEventListener( 'resize', onWindowResize );
    loadAndCreatePlot();
    animate();
}

// Animacija sa CameraControls
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    cameraControls.update(delta); // Ažurira kontrole kamere

    renderer.render(scene, camera);
}

const clock = new THREE.Clock(); // Za CameraControls update

// Fetch podataka i učitavanje plot-a
function fetchData() {
    return fetch('http://127.0.0.1:5000/plot_data')
        .then(response => response.json())
        .catch(error => console.error("Error fetching plot data:", error));
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
// Funkcija za kreiranje 2D plot-a
function createProteinPLot(data) {
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
            color: '#d3904b', // Boja za mlade (light blue)
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
            color: '#8C3061', // Boja za stare (red)
            opacity: 1,
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
        paper_bgcolor: "#000000",
        plot_bgcolor: "#000000",
        font: { color: "#ffffff" },
        showlegend: true,
        hovermode: 'closest'
    };


    // Kreiraj plot u #protein-plot div-u
    Plotly.newPlot('protein-plot', [traceYoung, traceOld], layout);
}

function loadGenePapers(geneName) {
    let allPapers = [];
    let visiblePapers = 3; // Početno prikazivanje 3 rada

    // Provera da li elementi postoje
    const sidebarContent = document.getElementById("scientific-paper");
    if (!sidebarContent) {
        console.error("Error: Element #scientific-paper not found.");
        return;
    }

    // Kreiraj "Show More" dugme ako ne postoji
    let loadMoreBtn = document.getElementById("loadMoreBtn");
    if (!loadMoreBtn) {
        loadMoreBtn = document.createElement("button");
        loadMoreBtn.id = "loadMoreBtn";
        loadMoreBtn.innerText = "Show More";
        loadMoreBtn.style.marginTop = "10px";
        sidebarContent.after(loadMoreBtn);
    }

    // Funkcija za prikaz radova
    function displayPapers() {
        sidebarContent.innerHTML = "Scientific papers related to gene:"; // Očisti prethodni sadržaj

        const list = document.createElement("ul");
        for (let i = 0; i < Math.min(visiblePapers, allPapers.length); i++) {
            const item = document.createElement("li");
            item.innerHTML = `<a href="${allPapers[i]}" target="_blank">PubMed link: ${allPapers[i]}</a>`;
            list.appendChild(item);
        }

        sidebarContent.appendChild(list);

        // Dodaj Show More dugme ako je potrebno
        if (visiblePapers < allPapers.length) {
            loadMoreBtn.style.display = "block";
            loadMoreBtn.innerText = "Show More";
        } else {
            loadMoreBtn.style.display = "block";
            loadMoreBtn.innerText = "Show Less";
        }

        // Omogućiti skrolovanje unutar scientific-paper div-a
        sidebarContent.style.maxHeight = "300px";
        sidebarContent.style.overflowY = "auto";
    }

    // Klik na Show More / Show Less
    loadMoreBtn.addEventListener("click", function () {
        if (loadMoreBtn.innerText === "Show More") {
            visiblePapers = allPapers.length; // Učitaj sve radove
        } else {
            visiblePapers = 3; // Resetuj na 3 rada
        }
        displayPapers(); // Ponovo prikaži radove
    });

    // Fetch podaci sa servera
    fetch(`/get_gene_papers?gene_name=${geneName}`)
        .then(response => response.json())
        .then(data => {
            if (data.pubmed_links && data.pubmed_links.length > 0) {
                allPapers = data.pubmed_links;
                visiblePapers = 3; // Resetuj početni broj prikazanih radova
                displayPapers();
            } else {
                sidebarContent.innerHTML = "<p>No related papers found.</p>";
            }
        })
        .catch(error => console.error("Error fetching data:", error));
}



function loadAndCreatePlot() {
    fetchData()
        .then(data => {
            if(is3D){
                create3DPlot(data);  // Kreiraj plot koristeći podatke
            }else{
                create2DPlot(data);
            }

            // simulateClickOnCenter();
        })
        .catch(error => {
            console.error("Error in loading or creating plot:", error);
        });
}



function lightenColor(material, factor = 0.2) {
    const color = new THREE.Color(material.color);
    color.offsetHSL(0, 0, factor); // Povećava svetlinu
    material.color.set(color);
}

function restoreOriginalColor() {
    if (selectedObject) {
        selectedObject.material.color.set(originalColor); // Vrati staru boju
        selectedObject = null;
    }
}

function dimOtherElements(scene, selectedObject, dimOpacity = 0.3, originalOpacity = 1) {
    scene.traverse((object) => {
        if (object.isMesh && object.material) {
            if (object === selectedObject) {
                object.material.opacity = originalOpacity; // Ostavlja kliknuti objekat nepromenjen
            } else {
                object.material.opacity = dimOpacity; // Smanjuje opacity za sve ostale
            }
        }
    });
}





// Kreiranje 2D plot-a
function create2DPlot(data) {
    console.log("create2DPlot data:", data);
    clearScene();
    resetTooltip();

    const minValue = Math.min(...data.y);
    const maxValue = Math.max(...data.y);
    console.log(maxValue);
    const geometry = new THREE.SphereGeometry(0.2, 32, 16); // Koristi istu veličinu loptica kao u prvom primeru
    points = [];
    const outlines = [];

    // Kreiramo tačke (spheres) na osnovu podataka
    for (let i = 0; i < data.x.length; i++) {
        let color = new THREE.Color(getColor(data.y[i], minValue, maxValue)); // Određivanje boje
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true, // Omogućava promenu opacity-a
            opacity: 1,
        });

        const sphere = new THREE.Mesh(geometry, material);

        // Skaliramo x i y vrednosti sa faktorom 10
        // Dodaj malu random varijaciju za razdvajanje tačaka
        sphere.position.set(data.x[i] * 50 + Math.random() * 0.5, data.y[i] * 20 - 60 + Math.random() * 0.5, 0);

        // // Kreiraj outline
        // const outlineSphere = new THREE.Mesh(geometry, outlineMaterial);
        // outlineSphere.scale.set(1.2, 1.2, 1.2); // Povećaj outline za 20%
        //
        // // Dodaj outline na istu poziciju
        // outlineSphere.position.copy(sphere.position);
        // scene.add(outlineSphere);
        // outlines.push(outlineSphere);

        // Dodaj originalnu loptu
        scene.add(sphere);
        points.push(sphere);

        // Dodaj geneName (ili drugi relevantni podaci) kao svojstvo na svakom objektu
        sphere.geneName = data.geneNames[i];
    }

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    tooltip.appendChild(renderer.domElement);
}

function clearScene() {
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    points = [];
}

function resetTooltip() {
    const tooltip = document.getElementById("tooltip");
    if (tooltip) {
        tooltip.innerHTML = `
            <div id="myDiv">
                <button id="toggleButton">2D</button>
                <button id="resetButton">Reset to Initial Position</button>
                <div id="elem-info"></div>
                <div id="sidebar">
                    <h2>Information</h2>
                    <div id="protein-plot"></div>
                    <div id="scientific-paper"></div>
                    <button id="loadMoreBtn"></button>
                    <div id="sidebar-content"></div>
<!--                    <button id="closeSidebar">Close</button>-->
                </div>
            </div>
        `;
    }
}



function create3DPlot(data) {
  console.log("create3DPlot data:", data);

  clearScene();
  resetTooltip();

  const minValue = Math.min(...data.y);
  const maxValue = Math.max(...data.y);
  console.log(maxValue);

  points = [];

  for (let i = 0; i < data.x.length; i++) {
    let color = new THREE.Color(getColor(data.y[i], minValue, maxValue));
    let scaleFactor = getScaledSize(data.y[i], minValue, maxValue);
    // Kreiramo geometriju direktno  bez pozivanja createBubble
    let geometry = new THREE.SphereGeometry(scaleFactor, 64, 32);

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
    });

    const sphere = new THREE.Mesh(geometry, material);

    sphere.position.set(
      data.x[i] * 50 + Math.random() * 2,
      data.y[i] * 12 - 40,
      Math.random() * 50
    );

    scene.add(sphere);
    points.push(sphere);

    sphere.geneName = data.geneNames[i];
  }

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  tooltip.appendChild(renderer.domElement);
}




function onMouseMove(event) {
    mousePointer = getMouseVector2(event, window);

    intersections = checkRayIntersections(mousePointer, camera, raycaster, scene, true); // Get first intersection
    const elementList = getSphereElements(intersections);

    // If no elements are hovered, hide the tooltip
    if (elementList.length === 0) {
        hideTooltip();
    } else {
        highlightSphereElements(elementList); // Show and highlight hovered elements
    }
}


function onClick(event) {
    // Prvo, izračunaj poziciju miša u normalizovanim koordinatama uređaja (-1 do 1)
    mousePointer = getMouseVector2(event, window);

    // Proveri da li postoji intersekcija između miša i objekata u sceni
    intersections = checkRayIntersections(mousePointer, camera, raycaster, scene, true);

    console.log("Inter in click:", intersections);

    if (intersections.object) {
        console.log("Mama draga");
        const clickedObject = intersections.object;
        console.log("Clicked object:", clickedObject);

        // Ako je prethodno bio selektovan objekat, vrati mu originalnu boju
        restoreOriginalColor();

        // Sačuvaj originalnu boju novog selektovanog objekta
        selectedObject = clickedObject;
        originalColor.copy(selectedObject.material.color);

        // Osvetli selektovani objekat
        lightenColor(selectedObject.material);
        dimOtherElements(scene, clickedObject);

        zoomToElement(clickedObject, true); // Enable smooth transition

        let geneName = clickedObject.geneName;  // Assuming geneName is inside metadata
        console.log(geneName); // Log geneName


        // Ako je kliknut element sa podacima o genu
        if (geneName) {
            fetchProteinConcentrationData(geneName)
                .then(proteinData => {
                    console.log(proteinData);
                    if (proteinData.young && proteinData.old) {
                        createProteinPLot(proteinData);
                        proteinPlot.setAttribute('style', 'display: block;');
                        loadGenePapers(geneName);
                        fillInData(proteinData);
                    } else {
                        console.error("Error: Missing data for plotting.");
                    }
                })
                .catch(error => {
                    console.error("Error fetching protein concentration data:", error);
                });

            function fillInData(proteinData) {
                const infoContainer = document.getElementById("sidebar-content");

                if (proteinData && proteinData.additionalInfo) {
                    infoContainer.innerHTML = `  
                        <h3>Protein Information for Gene: ${proteinData.additionalInfo.EntrezGeneSymbol}</h3>
                        <p><strong>Gene Name:</strong> ${proteinData.additionalInfo.TargetFullName}</p>
                        <p><strong>Target:</strong> ${proteinData.additionalInfo.Target}</p>
                        <p><strong>Entrez Gene ID:</strong> ${proteinData.additionalInfo.EntrezGeneID}</p>
                        <p><strong>Organism:</strong> ${proteinData.additionalInfo.Organism}</p>
                        <p><strong>Units:</strong> ${proteinData.additionalInfo.Units}</p>
                        <p><strong>Type:</strong> ${proteinData.additionalInfo.Type}</p>
                        <p><strong>Dilution:</strong> ${proteinData.additionalInfo.Dilution}</p>
                       
                    `;
                } else {
                    console.error("Protein data is missing or malformed.");
                }
            }
        }
    } else {
        // Ako je kliknuto izvan objekta, vrati originalnu boju prethodnog objekta
        restoreOriginalColor();
    }
}









function checkRayIntersections(mousePointer, camera, raycaster, scene, getFirstValue) {
    raycaster.setFromCamera(mousePointer, camera);

    // Get intersections in the scene
    let intersections = raycaster.intersectObjects(scene.children, true);

    // Log intersections
    // console.log('Intersections:', intersections);

    // Return only the first intersection if `getFirstValue` is true
    intersections = getFirstValue && intersections.length > 0 ? intersections[0] : intersections;

    return intersections || [];
}

// Function to calculate mouse position in normalized device coordinates (-1 to 1)
export function getMouseVector2(event, window){
    let mousePointer = new THREE.Vector2();

    mousePointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    return mousePointer;
}

export function getSphereElements(objectList) {
    const meshElements = [];

    // Log the objectList to see what you are getting
    // console.log("objectList:", objectList);

    // If the objectList is not an array (i.e., a single object), check it directly
    if (!Array.isArray(objectList)) {
        if (objectList?.object) { // Ensure that 'object' exists
            meshElements.push(objectList.object); // Push the mesh object
        }
        return meshElements;
    }

    // Otherwise, loop through the objectList (which is an array)
    objectList.forEach((object) => {
        if (object && object.object) { // Ensure that 'object' and 'object.object' exist
            meshElements.push(object.object); // Push the mesh object
        } else {
            console.warn("Object or object.object is undefined:", object);
        }
    });

    return meshElements;
}


function zoomToElement(targetElement, enableTransition) {
    if (!targetElement) return;

    // Check if the target element has a bounding box
    const boundingBox = new THREE.Box3().setFromObject(targetElement);

    // Use the cameraControls.fitToBox method to zoom to the target element
    cameraControls.fitToBox(boundingBox, enableTransition, {
        cover: false, // Set to false to prevent the camera from fully filling the screen with the element
        paddingTop: 2, // Optional: Add a little padding to the top
        paddingLeft: 2, // Optional: Add a little padding to the left
        paddingBottom:2, // Optional: Add a little padding to the bottom
        paddingRight: 2 // Optional: Add a little padding to the right
    }).then(() => {
        console.log("Zoom to element completed!");
    }).catch((error) => {
        console.error("Error in zoomToElement:", error);
    });
}



function highlightSphereElements(selectedElement) {

    // Ensure selectedElement is valid
    console.log(selectedElement[0]);
    selectedElement = selectedElement[0];
    if (selectedElement) {




        // Show tooltip
        if (selectedElement.geneName) {
            const screenPosition = projectToScreen(selectedElement.position, camera);
            showTooltip(
                selectedElement.position.x,
                selectedElement.position.y,
                selectedElement.geneName,
                screenPosition.x,
                screenPosition.y
            );
        }

    } else {
        console.warn("Selected element is not a valid THREE.Mesh object.");
    }
}






function projectToScreen(position, camera) {
    const vector = position.clone().project(camera);

    return {
        x: (vector.x + 1) * window.innerWidth / 2,
        y: (-vector.y + 1) * window.innerHeight / 2
    };
}

function showTooltip(x, y, geneName, screenX, screenY) {
    // Make sure the tooltip is visible only when hovered
    info.style.display = "block"; // Make the tooltip visible

    info.style.position = "absolute";
    info.style.left = `${screenX}px`;
    info.style.top = `${screenY}px`;
    info.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    info.style.color = "white";
    info.style.padding = "5px";
    info.style.borderRadius = "5px";
    info.style.fontSize = "12px";

    info.innerHTML = `
        <strong>Gene:</strong> ${geneName}<br>
        <strong>X:</strong> ${x.toFixed(2)}<br>
        <strong>Y:</strong> ${y.toFixed(2)}
    `;
}


function hideTooltip() {
    info.style.display = "none"; // Hide the tooltip when not hovering
}



function getColor(value, minValue, maxValue) {
    const colorsLow = ['rgba(82, 34, 88)', 'rgba(140, 48, 97)', 'rgba(198, 60, 81)', 'rgba(211, 144, 75)', 'rgba(217, 119, 89)'];
    const colorsHigh = ['rgba(217, 147, 89)', 'rgba(241,189,46)', 'rgba(241,213,135)'];

    const yMid = (minValue + maxValue) / 2;
    const rangeLow = yMid - minValue;
    const rangeHigh = maxValue - yMid;

    let normalizedValue;
    let colorIndex;

    if (value <= yMid) {
        normalizedValue = (value - minValue) / rangeLow;
        colorIndex = Math.floor(normalizedValue * 5);
        return colorsLow[colorIndex];
    } else {
        normalizedValue = (value - yMid) / rangeHigh;
        colorIndex = Math.floor(normalizedValue * (colorsHigh.length - 1));
        return colorsHigh[colorIndex];
    }
}

function getScaledSize(value, minValue, maxValue) {
    const midThreshold = minValue + (maxValue - minValue) * 0.5; // 80% tačke vrednosti

    if (value <= midThreshold) {
        // Prvih 80% ide od 0.08 do 0.8
        return 0.08 + ((value - minValue) / (midThreshold - minValue)) * (1.5 - 0.08);
    } else {
        // Preostalih 20% ide od 0.8 do 3, ali ako pređe 20, postavi ga na 20
        const size = 0.8 + ((value - midThreshold) / (maxValue - midThreshold)) * (12 - 0.8);
        return Math.min(size, 20); // Ova linija postavlja maksimalnu veličinu na 20
    }
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}



// Pokretanje aplikacije
window.addEventListener("DOMContentLoaded", () => {
    init();
    const toggleButton = document.getElementById("toggleButton");
    toggleButton.textContent = "2D"; // Dugme počinje s natpisom '2D'
    const testPageButton = document.getElementById("testButton");

    toggleButton.addEventListener("click", function () {
        if (is3D) {
            loadAndCreatePlot();
            toggleButton.textContent = "3D"; // Kada je u 2D modu, dugme treba da kaže '3D'
        } else {
            loadAndCreatePlot();
            toggleButton.textContent = "2D"; // Kada je u 3D modu, dugme treba da kaže '2D'
        }
        is3D = !is3D; // Obrće stanje prikaza
    });

    // Dodajemo event listener za dugme
    testPageButton.addEventListener('click', function() {
        window.location.href =  '/test-page'; // Pozivamo Flask rutu koja vodi do test.html
    });
});
