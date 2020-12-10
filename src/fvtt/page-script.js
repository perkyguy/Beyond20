/*
from utils import addCustomEventListener;
*/
var settings = null;
var extension_url = "/modules/beyond20/";

function setSettings(new_settings, url) {
    settings = new_settings;
    extension_url = url;
}

function disconnectAllEvents() {
    for (let event of registered_events)
        document.removeEventListener(...event);
}

function setTitle() {
    const chatControls = $("#chat-controls");
    if (chatControls.length) {
        const title = document.getElementsByTagName("title")[0];
        // Make sure the mutation gets triggerred if (we reload the extension;
        title.textContent = "Foundry Virtual Tabletop";
        title.textContent = game.world.title + " • Foundry Virtual Tabletop";
    } else {
        // Wait for the world and UI to be loaded;
        Hooks.once("renderChatLog", setTitle);
    }
}

class Utilities {
    static getGRFlag(entity, flag, isData = false) {
        if (!entity) { return undefined; }

        const dataLevel = isData ? entity : entity.data;
        if (!dataLevel.flags || !dataLevel.flags.greenRoom) {
            return undefined;
        }
    
        return dataLevel.flags.greenRoom[flag]
    }
    static setGRFlag(entity, flag, value, { isData = false }) {
        if (!entity) {
            return;
        }
        const dataLevel = isData ? entity : entity.data;
        if (!dataLevel.flags) {
            dataLevel.flags = {};
        }
    
        if (!dataLevel.flags.greenRoom) {
            dataLevel.flags.greenRoom = {};
        }
    
        return dataLevel.flags.greenRoom[flag] = value;
    }
    
    static getGRIdFlag(entity) {
        return Utilities.getGRFlag(entity, "id") || "";
    }
    
    static makeId(name, parentFolder) {
        const currentName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        return [Utilities.getGRIdFlag(parentFolder), currentName].filter(Boolean).join('-')
    }
    
    static async createDir(name, parentFolder, type) {
        const id = (!parentFolder ? `${type.toLowerCase()}-` : '') + Utilities.makeId(name, parentFolder);
        const existingDir = game.folders.find(f => Utilities.getGRIdFlag(f) === id);
        if (Boolean(existingDir)) {
            return existingDir;
        }
        
        const data = {
            name,
            type,
            parent: parentFolder ? parentFolder.id : null,
        };
        Utilities.setGRFlag(data, "id", id, { isData: true });
        const folder = await Folder.create(data);
        if (!folder) {
            throw new Error(`Couldn't create the folder for some reason :(`);
        }
        return folder;
    };
}

async function createJournalEntries({ sourceName, chapterName, maps }) {
    const sourceDir = await Utilities.createDir(sourceName, null, "JournalEntry");
    const chapterDir = await Utilities.createDir(chapterName, sourceDir, "JournalEntry");
    
    for (let { mapTitle, sections } of maps) {
        if (!sections) { continue; }

        const sectionName = mapTitle;
        const sectionDir = await Utilities.createDir(sectionName, chapterDir, "JournalEntry");
        for (let {mapLetter, area, subArea, areaName, content} of sections) {
            const areaValue = Boolean(area) ? [mapLetter, area, subArea].filter(Boolean).slice(-2).concat(': ').join('') : '';
            const entryId = Utilities.makeId(areaValue, sectionDir);
            const current = game.journal.find(entry => Utilities.getGRIdFlag(entry) === entryId);
            
            const entryData = {
                _id: entryId,
                name: `${areaValue}${areaName}`,
                folder: sectionDir.id,
            }
            Utilities.setGRFlag(entryData, "id", entryId, { isData: true });
            const entryUpdate = { content: content.join('<br />') };

            await (Boolean(current) ? current.update(entryUpdate) : JournalEntry.create({ ...entryData, ...entryUpdate}));
        }
    }

    await game.journal.render();
}

async function tryCreateDataDirectory(source, target) {
    try {
        await FilePicker.createDirectory(source, target)
    } catch (e) {}
}


async function downloadViaFetch(url) {
    const proxyUrl = getProxiedURL(url);
    const response = await fetch(proxyUrl);
    const data = await response.blob();
    return data;
}

async function getUploadLocations() {
    const source = "data";
    const target = "/uploads/green-room";
    await tryCreateDataDirectory(source, "/uploads");
    await tryCreateDataDirectory(source, target)
    return { source, target };
}

function getProxiedURL(url) {
    return url.toLowerCase().indexOf("http") === 0 ? "https://proxy.iungimus.de/get/" + url : url;
}

async function uploadFromUrl({ url, filename }) {
    const outputName = filename || url.split('/').pop();
    const { source, target } = await getUploadLocations();
    
    const existingFile = (await FilePicker.browse(source, target)).files.find(f => f.includes(outputName));
    if (existingFile) {
        return existingFile;
    }
    const blob = await downloadViaFetch(url);

    const file = new File([blob], outputName);
    await FilePicker.upload(source, target, file);
    return (await FilePicker.browse(source, target)).files.find(f => f.includes(outputName));
}

async function createScenes({ sourceName, chapterName, maps}) {
    const sourceDir = await Utilities.createDir(sourceName, null, "Scene");
    const chapterDir = await Utilities.createDir(chapterName, sourceDir, "Scene");
    
    for (let { mapTitle, imageLink } of maps) {
        const uploadLink = await uploadFromUrl({ url: imageLink, })
        
        const sceneId = Utilities.makeId(mapTitle, chapterDir);
        const current = game.scenes.find(scene => Utilities.getGRIdFlag(scene) === sceneId);
        
        if (current) { await updateSceneDetails(current); continue; }

        const sceneData = {
            _id: sceneId,
            name: mapTitle,
            folder: chapterDir.id,
            img: uploadLink,
            ...customData.scene,
        }
        Utilities.setGRFlag(sceneData, "id", sceneId, { isData: true });
        await Scene.create(sceneData);
    }

    await game.scenes.render();
}

async function rebuildLights(scene, newData) {
    const IS_GR_PLACEABLE = "isGRPlaceable";
    console.log(newData);
    if (!newData.lights) {
        newData.lights = [];
    }
    
    for (let light of newData.lights) {
        Utilities.setGRFlag(light, IS_GR_PLACEABLE, true, { isData: true });
    }

    for (let light of scene.data.lights) {
        if (Utilities.getGRFlag(light, IS_GR_PLACEABLE, true)) {
            const canvasWall = canvas.lighting.get(light._id);
            if (canvasWall) { 
                await canvasWall.delete()
            }
        }
    }
    
    // // Add in all the user-added walls to our new one
    newData.lights = newData.lights.concat(scene.data.lights.filter(l => !Utilities.getGRFlag(l, IS_GR_PLACEABLE, true)))

    return newData;
}

async function rebuildWalls(scene, newData) {
    const IS_GR_PLACEABLE = "isGRPlaceable";
    if (!newData.walls) {
        newData.walls = [];
    }

    // Make sure that we have flagged all of our new walls
    for (let wall of newData.walls) {
        Utilities.setGRFlag(wall, IS_GR_PLACEABLE, true, { isData: true });
    }

    // Delete all of our old walls :()
    for (let wall of scene.data.walls) {
        if (Utilities.getGRFlag(wall, IS_GR_PLACEABLE, true)) {
            const canvasWall = canvas.walls.get(wall._id);
            if (canvasWall) { 
                await canvasWall.delete()
            }
        }
    }
    
    // // Add in all the user-added walls to our new one
    newData.walls = newData.walls.concat(scene.data.walls.filter(w => !Utilities.getGRFlag(w, IS_GR_PLACEABLE, true)))

    return newData;
}

async function updateSceneDetails(scene) {
    const details = await getSceneSettings(scene);
    if (!details) {
        return;
    }
    await rebuildWalls(scene, details);
    await rebuildLights(scene, details);
    
    await scene.update(details);
    await scene.render();
}

async function getSceneSettings(scene) {
    const sceneId = Utilities.getGRIdFlag(scene);
    console.log(sceneId);
    try {
        const response = await fetch(`${sceneId}.json`);
        if (!response) return false;
        const data = await response.json();
        return data;
    } catch (e) {
        console.info(`No scene file exists for ${sceneId}`);
    }
    return false;
}

async function sceneImport(req) {
    await createJournalEntries(req);
    await createScenes(req);

}

console.log("Beyond20: Foundry VTT Page Script loaded");
const registered_events = [];
registered_events.push(addCustomEventListener("NewSettings", setSettings));
registered_events.push(addCustomEventListener("disconnect", disconnectAllEvents));
registered_events.push(addCustomEventListener("SceneImport", sceneImport));
//const alertify = ui.notifications;
setTitle();
