/* global AdsumClientApi AdsumWebMap dat */

const errorDiv = document.getElementById('error');
const loadingDiv = document.getElementById('loading');

// Put in upper scope to be able to access them on onStart later on
let entityManager, adsumWebMap;

function onError(e) {
  console.error(e);
  loadingDiv.classList.add('hidden');
  errorDiv.classList.remove('hidden');
}

const behaviorControls = {onClick: 'edit'};
let gui = null;

function onStart() {
  loadingDiv.classList.add('hidden');

  gui = new dat.GUI();

  const floorControls = {
    // The current floor label
    currentFloor: "none",
    // A map containing the display name to floor id
    floorNameToId: {
      "none": null,
    },
    // Handle User floor change
    changeFloor: (floorName) => {
      const floorID = floorControls.floorNameToId[floorName];

      const floorObject = floorID === null ? null : adsumWebMap.objectManager.floors.get(floorID);

      // First change the floor
      return adsumWebMap.sceneManager.setCurrentFloor(floorObject)
        .then(() => {
          // Don't forget to center the camera on floor !
          return adsumWebMap.cameraManager.centerOnFloor(floorObject);
        });
    }
  };

  // Get all the floors to aliment the floor select list
  adsumWebMap.objectManager.floors.forEach((floorObject) => {
    floorControls.floorNameToId[floorObject.name] = floorObject.id;
  });

  // Update the floor controls as depending of the device, the default floor is not always none.
  const currentFloorObject = adsumWebMap.sceneManager.currentFloor;
  floorControls.currentFloor = currentFloorObject === null ? "none" : currentFloorObject.name;

  gui.add(
    floorControls, // The object containing the data
    'currentFloor', // The property to update
    Object.keys(floorControls.floorNameToId), // List of choices
  )
    .listen() // listen currentFloor changes
    .onChange(floorControls.changeFloor);

  // Add the onClick behavior selection
  gui.add(behaviorControls, 'onClick', ['edit', 'createText', 'createImage', 'delete', 'levelOfDetails'])
    .onFinishChange(() => {
      // Make sure to reset the edition
      edit(null);
    });

  // Let's add the event listener
  adsumWebMap.mouseManager.addEventListener(
    AdsumWebMap.MOUSE_EVENTS.click,
    (event) => {
      switch (behaviorControls.onClick) {
        case 'edit':
          edit(getClickedLabel(event.intersects));
          break;
        case 'createText':
          createLabelText(event);
          break;
        case 'createImage':
          createLabelImage(event);
          break;
        case 'delete':
          deleteLabel(event);
          break;
      }
    }
  );
}

let currentLabelObject = null;
let propertiesUi = null;

function edit(labelObject) {
  if (currentLabelObject === labelObject) {
    return;
  }

  if (currentLabelObject !== null) {
    currentLabelObject.unselect();
    currentLabelObject = null;

    // Remove the UI on unselect
    gui.removeFolder(propertiesUi);
    propertiesUi = null;
  }

  if (labelObject !== null) {
    labelObject.select();

    // Create the label edition UI
    propertiesUi = gui.addFolder('Properties');
    if (labelObject.isLabelText) {
      createLabelTextUi(propertiesUi, labelObject);
    } else {
      createLabelImageUi(propertiesUi, labelObject);
    }
    propertiesUi.open();
  }

  currentLabelObject = labelObject;

  updateLevelOfDetailsUi();
}

function getClickedLabel(intersects) {
  if (intersects.length === 0) {
    return null;
  }

  // Let's grab the first intersect
  let {object} = intersects[0];

  if (object.isLabel) {
    return object;
  }

  // If building or space, then let's select the first label if any
  if (object.isBuilding || object.isSpace) {
    // labels is a Set, let's convert to Array
    const labels = Array.from(object.labels.values());

    return labels.length === 0 ? null : labels[0];
  }

  return null;
}

function createLabelObjectBaseUi(ui, labelObject) {
  ui
    .add({autoScale: labelObject.autoScale}, 'autoScale')
    .onChange((autoScale) => {
      labelObject.setAutoScale(autoScale);
    });

  ui
    .add({isPermanentDisplay: labelObject.isPermanentDisplay}, 'isPermanentDisplay')
    .onChange((isPermanentDisplay) => {
      labelObject.setPermanentDisplay(isPermanentDisplay);
    });

  ui
    .add(
      {orientationMode: labelObject.orientationMode},
      'orientationMode',
      [
        AdsumWebMap.LABEL_ORIENTATION_MODES.BILLBOARD,
        AdsumWebMap.LABEL_ORIENTATION_MODES.STATIC,
      ],
    )
    .onChange((orientationMode) => {
      labelObject.setOrientationMode(orientationMode);
    });

  ui
    .add({offsetX: labelObject.offset.x}, 'offsetX')
    .onChange((offsetX) => {
      labelObject.moveTo(
        offsetX,
        labelObject.offset.y,
        labelObject.offset.z,
      );
    });

  ui
    .add({offsetY: labelObject.offset.y}, 'offsetY')
    .onChange((offsetY) => {
      labelObject.moveTo(
        labelObject.offset.x,
        offsetY,
        labelObject.offset.z,
      );
    });

  ui
    .add({offsetZ: labelObject.offset.z}, 'offsetZ')
    .onChange((offsetZ) => {
      labelObject.moveTo(
        labelObject.offset.x,
        labelObject.offset.y,
        offsetZ,
      );
    });

  ui
    .add(
      {opacity: labelObject.opacity},
      'opacity',
      0,
      1,
      0.1,
    )
    .onChange((opacity) => {
      labelObject.setOpacity(opacity);
    });

  ui
    .add(
      {rotation: labelObject.rotation},
      'rotation',
      0,
      360,
      1,
    )
    .onChange((rotation) => {
      labelObject.setRotation(rotation);
    });

  ui
    .add({scaleX: labelObject.scale.x}, 'scaleX')
    .onChange((scaleX) => {
      labelObject.setScale(
        scaleX,
        labelObject.scale.y,
        labelObject.scale.z,
      );
    });

  ui
    .add({scaleY: labelObject.scale.y}, 'scaleY')
    .onChange((scaleY) => {
      labelObject.setScale(
        labelObject.scale.x,
        scaleY,
        labelObject.scale.z,
      );
    });

  ui
    .add({scaleZ: labelObject.scale.z}, 'scaleZ')
    .onChange((scaleZ) => {
      labelObject.setScale(
        labelObject.scale.x,
        labelObject.scale.y,
        scaleZ,
      );
    });
}

function createLabelImageUi(ui, labelObject) {
  createLabelObjectBaseUi(ui, labelObject);

  ui
    .add({image: labelObject.image}, 'image')
    .onChange((image) => {
      labelObject.setImage(image);
    });

  ui
    .add({height: labelObject.height}, 'height')
    .onChange((height) => {
      labelObject.setHeight(height);
    });

  ui
    .add({width: labelObject.width}, 'width')
    .onChange((width) => {
      labelObject.setWidth(width);
    });
}

function createLabelTextUi(ui, labelObject) {
  createLabelObjectBaseUi(ui, labelObject);

  ui
    .add({text: labelObject.text.replace('\n', '\\n')}, 'text')
    .onChange((text) => {
      labelObject.setText(text.replace('\\n', '\n'));
    });

  ui
    .add({font: labelObject.style.font}, 'font')
    .onChange((font) => {
      labelObject.setStyle({font});
    });

  ui
    .add({size: labelObject.style.size}, 'size')
    .onChange((size) => {
      labelObject.setStyle({size});
    });

  ui
    .addColor({color: labelObject.style.color}, 'color')
    .onChange((color) => {
      labelObject.setStyle({color});
    });

  ui
    .add({lineHeight: labelObject.style.lineHeight}, 'lineHeight')
    .onChange((lineHeight) => {
      labelObject.setStyle({lineHeight});
    });

  ui
    .addColor({backgroundColor: labelObject.style.backgroundColor}, 'backgroundColor')
    .onChange((backgroundColor) => {
      labelObject.setStyle({backgroundColor});
    });

  ui
    .add(
      {backgroundOpacity: labelObject.style.backgroundOpacity},
      'backgroundOpacity',
      0,
      1,
    )
    .onChange((backgroundOpacity) => {
      labelObject.setStyle({backgroundOpacity});
    });

  ui
    .add({backgroundPadding: labelObject.style.backgroundPadding}, 'backgroundPadding')
    .onChange((backgroundPadding) => {
      labelObject.setStyle({backgroundPadding});
    });

  ui
    .add({backgroundRadius: labelObject.style.backgroundRadius}, 'backgroundRadius')
    .onChange((backgroundRadius) => {
      labelObject.setStyle({backgroundRadius});
    });

  ui
    .add({quality: labelObject.style.quality}, 'quality')
    .onChange((quality) => {
      labelObject.setStyle({quality});
    });

  return ui;
}

function updateLevelOfDetailsUi() {
  const lodUi = document.getElementById('lod-ui');
  if (currentLabelObject === null) {
    lodUi.classList.add('hidden');
  } else {
    lodUi.classList.remove('hidden');

    const levelStates = currentLabelObject.levelOfDetails.getLevelStates();

    const levelsUi = document.getElementById('lod-list');
    levelsUi.innerHTML = '';

    levelStates.forEach(({ startAt, levelState }) => {
      const row = document.createElement('tr');

      const key = document.createElement('td');
      key.innerText = String(startAt);
      row.appendChild(key);

      const value = document.createElement('td');
      value.innerText = levelState.displayMode;
      row.appendChild(value);

      const removeCell = document.createElement('td');
      const removeBtn = document.createElement('button');
      removeBtn.innerText = "Remove";
      removeBtn.onclick = () => {
        currentLabelObject.levelOfDetails.removeLevelState(startAt);
        updateLevelOfDetailsUi();
      };
      removeCell.appendChild(removeBtn);
      row.appendChild(removeCell);

      levelsUi.appendChild(row);
    });
  }
}

function addLevelState() {
  if (currentLabelObject !== null) {
    const startAt = parseFloat(document.getElementById('startAt').value);
    const displayMode = document.getElementById('displayMode').value;

    currentLabelObject.levelOfDetails.addLevelState(startAt, new AdsumWebMap.DisplayLevelState(displayMode));
    updateLevelOfDetailsUi();
  }
}

document.getElementById('lod-add-action').onclick = addLevelState;

function createLabelText(mouseEvent) {
  if (mouseEvent.intersects.length === 0) {
    return;
  }

  let {object, position} = mouseEvent.intersects[0];

  if (object.isSite || object.isBuilding || object.isFloor || object.isSpace) {
    const label = new AdsumWebMap.LabelTextObject({
      text: 'Hello world !\nThis is a multi-line one.',
      offset: position
    });
    adsumWebMap.objectManager.addLabel(label, object);
  }
}

function createLabelImage(mouseEvent) {
  if (mouseEvent.intersects.length === 0) {
    return;
  }

  let {object, position} = mouseEvent.intersects[0];

  if (object.isSite || object.isBuilding || object.isFloor || object.isSpace) {
    const label = new AdsumWebMap.LabelImageObject({
      image: '/files/homer-simpson.png', width: 60, height: 60, offset: position,
    });
    adsumWebMap.objectManager.addLabel(label, object);
  }
}

function deleteLabel(mouseEvent) {
  if (mouseEvent.intersects.length === 0) {
    return;
  }

  let {object} = mouseEvent.intersects[0];

  if (object.isLabel) {
    adsumWebMap.objectManager.removeLabel(object);
  } else if (object.isBuilding || object.isSpace) {
    object.labels.forEach((label) => {
      adsumWebMap.objectManager.removeLabel(label);
    });
  }
}

// Global try / catch to prevent errors
try {
  // AdsumClientApi and AdsumWebMap namespaces are available globally

  // Create an entityManager using the API credentials (see AdsumClientAPI documentation for more details)
  entityManager = new AdsumClientApi.EntityManager({
    "endpoint": "https://api.adsum.io",
    "site": 322,
    "username": "323-device",
    "key": "343169bf805f8abd5fa71a4f529594a654de6afbac70a2d867a8b458c526fb7d"
  });

  // Create the loader responsible for converting Adsum data into the 3D engine
  const adsumLoader = new AdsumWebMap.AdsumLoader({
    entityManager, // Give it in order to be used to consume REST API
    deviceId: 323 // The device Id to use
  });

  // Create the Map instance
  adsumWebMap = new AdsumWebMap.AdsumWebMap({
    loader: adsumLoader, // The loader to use
    engine: {
      container: document.getElementById('adsum-web-map-container'), // The div DOMElement to insert the canvas into
    }
  });


  // Init the Map
  adsumWebMap.init()
    .then(() => {
      // Start the rendering
      return adsumWebMap.start();
    })
    .then(onStart, onError); // Add the resolve / reject callback
} catch (e) {
  onError();
}
