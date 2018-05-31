const errorDiv = document.getElementById('error');
const loadingDiv = document.getElementById('loading');

const onError = () => {
  loadingDiv.classList.add('hidden');
  errorDiv.classList.remove('hidden'); // Display error image
};

// Put in upper scope to be able to access them on onStart later on
let entityManager, adsumWebMap;

const onStart = () => {
  loadingDiv.classList.add('hidden'); // Remove loading image

  // Create the gui instance
  const gui = new dat.GUI();

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
          // Then center on Floor
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

  const selectionControls = {
    // Store the selection
    current: null,
    currentPath: null, // Add it in order to be able to remove previous paths when a new is drawn
    // As our behavior is async based, we will use a locked to prevent concurrent selection
    locked: false,
    updateSelection: (object) => {
      // Do nothing if it's already selected
      if (selectionControls.locked || object === selectionControls.current) {
        return;
      }

      // Make sure to unselect previously selected
      if (selectionControls.current !== null && selectionControls.current.isBuilding) {
        selectionControls.resetBuilding(selectionControls.current);
      } else if (selectionControls.current !== null && selectionControls.current.isSpace) {
        selectionControls.resetSpace(selectionControls.current);
      } else if (selectionControls.current !== null && selectionControls.current.isLabel) {
        selectionControls.resetLabel(selectionControls.current);
      }

      selectionControls.current = object;

      if (selectionControls.current !== null && selectionControls.current.isBuilding) {
        selectionControls.locked = true;
        selectionControls.highlightBuilding(selectionControls.current)
          .then(() => {
            selectionControls.locked = false;
          });
      } else if (selectionControls.current !== null && selectionControls.current.isSpace) {
        selectionControls.locked = true;
        selectionControls.highlightSpace(selectionControls.current)
          .then(() => pathControls.goTo(selectionControls.current))
          .then(() => {
            selectionControls.locked = false;
          });
      } else if (selectionControls.current !== null && selectionControls.current.isLabel) {
        selectionControls.locked = true;
        selectionControls.highlightLabel(selectionControls.current)
          .then(() => pathControls.goTo(selectionControls.current))
          .then(() => {
            selectionControls.locked = false;
          });
      }
    },
    highlightBuilding: (building) => {
      return adsumWebMap.cameraManager.centerOn(building)
        .then(() => {
          building.setColor(0x78e08f);
          building.labels.forEach((labelObject) => {
            labelObject.select();
          })
        });
    },
    resetBuilding: (building) => {
      building.resetColor();
      building.labels.forEach((labelObject) => {
        labelObject.unselect();
      })
    },
    highlightSpace: (space) => {
      return adsumWebMap.cameraManager.centerOn(space)
        .then(() => {
          space.setColor(0x78e08f);
          space.bounceUp(3);
          space.labels.forEach((labelObject) => {
            labelObject.select();
          })
        });
    },
    highlightLabel: (label) => {
      return adsumWebMap.cameraManager.centerOn(label)
        .then(() => {
          label.select();
        });
    },
    resetSpace: (space) => {
      space.resetColor();
      space.bounceDown();

      space.labels.forEach((labelObject) => {
        labelObject.unselect();
      })
    },
    resetLabel: (label) => {
      label.unselect();
    },
    // The click event handler
    onClick: ({intersects}) => {
      // intersects is an array of intersected objects on the click location
      // intersects will be sort by deep in order

      if (intersects.length === 0) {
        selectionControls.updateSelection(null);
        return;
      }

      const firstIntersect = intersects[0];
      if (firstIntersect.object.isBuilding || firstIntersect.object.isSpace) {
        selectionControls.updateSelection(firstIntersect.object);
      } else if (firstIntersect.object.isLabel) {
        // Special label behavior
        const labelParent = firstIntersect.object.parent;
        if (labelParent.isBuilding || labelParent.isSpace) {
          // Prefer select the parent
          selectionControls.updateSelection(labelParent);
        } else {
          selectionControls.updateSelection(firstIntersect.object);
        }
      } else {
        selectionControls.updateSelection(null);
      }
    },
    onDblClick: ({intersects}) => {
      // intersects is an array of intersected objects on the dblClick location
      // intersects will be sort by deep in order

      if (intersects.length > 0) {
        const firstIntersect = intersects[0];
        if (firstIntersect.object.isSite) {
          selectionControls.locked = true;
          adsumWebMap.sceneManager.setCurrentFloor(null)
            .then(() => adsumWebMap.cameraManager.centerOnFloor(null))
            .then(() => {
              selectionControls.locked = false;
            });
        } else if (firstIntersect.object.isFloor) {
          selectionControls.locked = true;
          adsumWebMap.sceneManager.setCurrentFloor(firstIntersect.object)
            .then(() => adsumWebMap.cameraManager.centerOnFloor(firstIntersect.object))
            .then(() => {
              selectionControls.locked = false;
            });
        }
      }
    }
  };

  // Register mouse listener events
  adsumWebMap.mouseManager.addEventListener(AdsumWebMap.MOUSE_EVENTS.click, selectionControls.onClick);
  adsumWebMap.mouseManager.addEventListener(AdsumWebMap.MOUSE_EVENTS.dblClick, selectionControls.onDblClick);
};

const pathControls = {
  current: null,
  goTo: (object) => {
    if (pathControls.current !== null) {
      // Remove previously drawn paths
      adsumWebMap.wayfindingManager.removePath(pathControls.current);
    }

    // Get the object location
    const location = adsumWebMap.wayfindingManager.locationRepository.get(object.placeId);

    // Create path from user location (null) and object location
    pathControls.current = new AdsumWebMap.Path(null, location);

    // Compute the path to find the shortest path
    return adsumWebMap.wayfindingManager.computePath(pathControls.current)
      .then(() => {
        // The path is computed, and we have now access to path.pathSections which represents all steps
        // We will chain our promises
        let promise = Promise.resolve();
        for(const pathSection of pathControls.current.pathSections) {

          // Do the floor change
          const floor = pathSection.ground.isFloor ? pathSection.ground : null;
          promise = promise.then(() => adsumWebMap.sceneManager.setCurrentFloor(floor));
          promise = promise.then(() => adsumWebMap.cameraManager.centerOnFloor(floor));

          // Draw the step
          promise = promise.then(() => adsumWebMap.wayfindingManager.drawPathSection(pathSection));

          // Find any attached labelObjects to the pathSection destination
          let labelObjects = [];
          if (pathSection.to !== null && pathSection.to.adsumObject !== null) {
            const { adsumObject } = pathSection.to;
            if (adsumObject.isLabel) {
              labelObjects = [adsumObject];
            } else if (adsumObject.isBuilding || adsumObject.isSpace) {
              labelObjects = adsumObject.labels;
            }
          }

          // Select label objects
          promise = promise.then(() => labelObjects.forEach(labelObject => labelObject.select()));

          // Add a delay of 1.5 seconds
          promise = promise.then(() => new Promise((resolve) => {
            setTimeout(resolve, 1500);
          }));

          // Unselect the label objects
          promise = promise.then(() => labelObjects.forEach(labelObject => labelObject.unselect()));
        }

        return promise;
      });
  }
};

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
