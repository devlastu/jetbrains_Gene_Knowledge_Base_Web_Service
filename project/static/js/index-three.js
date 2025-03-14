import * as THREE from 'three';
import CameraControls from 'camera-controls';

// Tooltip i osnovne promenljive
const tooltip = document.getElementById('myDiv');
let scene, camera, renderer, cameraControls, raycaster, mouse, points, mousePointer;
// Kreiraj novi tooltip element
const info = document.getElementById("elem-info");
// Omogućavanje CameraControls
CameraControls.install({ THREE: THREE });



function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    tooltip.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, -30);
    // Add listener to call onMouseMove every time the mouse moves in the browser window
    document.addEventListener('mousemove', onMouseMove, false);
    console.log("Scene and camera initialized:", scene, camera); // Check initialization

    // Inicijalizacija CameraControls
    cameraControls = new CameraControls(camera, renderer.domElement);
    cameraControls.dollyToCursor = true;
    cameraControls.setLookAt(0, 0, -30, 0, 0, 0); // Početna pozicija i fokus

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

function loadAndCreatePlot() {
    fetchData()
        .then(data => {
            console.log("Fetched data:", data);
            create2DPlot(data);
        })
        .catch(error => console.error("Error in loading or creating plot:", error));
}
let outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0x0000, // Outline color (green)
    side: THREE.BackSide, // To create an outline effect
    opacity: 0.5, // Make outline semi-transparent
    transparent: true
});

// Kreiranje 2D plot-a
function create2DPlot(data) {
    console.log("create2DPlot data:", data);

    const minValue = Math.min(...data.y);
    const maxValue = Math.max(...data.y);
    console.log(maxValue);
    const geometry = new THREE.SphereGeometry(0.08, 32, 16); // Koristi istu veličinu loptica kao u prvom primeru
    points = [];
    const outlines = [];

    // Kreiramo tačke (spheres) na osnovu podataka
    for (let i = 0; i < data.x.length; i++) {
        let color = new THREE.Color(getColor(data.y[i], minValue, maxValue)); // Određivanje boje
        const material = new THREE.MeshBasicMaterial({ color });

        const sphere = new THREE.Mesh(geometry, material);

        // Skaliramo x i y vrednosti sa faktorom 10
        // Dodaj malu random varijaciju za razdvajanje tačaka
        sphere.position.set(data.x[i] * 10 + Math.random() * 0.5, data.y[i] * 5 - 20 + Math.random() * 0.5, 0);

        // Kreiraj outline
        const outlineSphere = new THREE.Mesh(geometry, outlineMaterial);
        outlineSphere.scale.set(1.2, 1.2, 1.2); // Povećaj outline za 20%

        // Dodaj outline na istu poziciju
        outlineSphere.position.copy(sphere.position);
        scene.add(outlineSphere);
        outlines.push(outlineSphere);

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



function onMouseMove(event) {
    mousePointer = getMouseVector2(event, window);

    const intersections = checkRayIntersections(mousePointer, camera, raycaster, scene, true); // Get first intersection
    const elementList = getSphereElements(intersections);

    // If no elements are hovered, hide the tooltip
    if (elementList.length === 0) {
        hideTooltip();
    } else {
        highlightSphereElements(elementList); // Show and highlight hovered elements
    }
}



function checkRayIntersections(mousePointer, camera, raycaster, scene, getFirstValue) {
    raycaster.setFromCamera(mousePointer, camera);

    // Get intersections in the scene
    let intersections = raycaster.intersectObjects(scene.children, true);

    // Log intersections
    console.log('Intersections:', intersections);

    // Return only the first intersection if `getFirstValue` is true
    intersections = getFirstValue && intersections.length > 0 ? intersections[0] : intersections;

    return intersections;
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
    console.log("objectList:", objectList);

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

function highlightSphereElements(elementList) {
    // Reset previous highlights
    points.forEach((point) => {
        if (point.material) {
            point.material.transparent = true;
            point.material.opacity = 1.0;

            // Reset outline if it exists
            if (point.outline) {
                scene.remove(point.outline);
                point.outline = null;
            }
        }
    });

    elementList.forEach((element) => {
        if (element && element.material) {
            // Set reduced opacity for highlighting
            element.material.transparent = true;
            element.material.opacity = 0.5;

            // Create outline effect
            const outlineMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff, // White outline
                side: THREE.BackSide,
            });

            const outlineMesh = new THREE.Mesh(element.geometry, outlineMaterial);
            outlineMesh.scale.multiplyScalar(1.05); // Slightly enlarge outline
            element.outline = outlineMesh;
            scene.add(outlineMesh);

            // Show tooltip with geneName when hovering
            if (element.geneName) {
                const screenPosition = projectToScreen(element.position, camera);
                showTooltip(element.position.x, element.position.y, element.geneName, screenPosition.x, screenPosition.y);
            }
        }
    });
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

// Pokretanje aplikacije
window.addEventListener("DOMContentLoaded", () => {
    init();
});
