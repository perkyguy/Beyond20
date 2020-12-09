/*
from utils import addCustomEventListener;
from settings import WhisperType;
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
    static getGRFlag(entity, flag) {
        if (!entity || !entity.data.flags || !entity.data.flags.greenRoom) {
            return undefined;
        }
    
        return entity.data.flags.greenRoom[flag]
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
    } catch (e) {
        console.log(`Ignoring the directory create error`, e)
    }
}

async function uploadFromUrl({ url, filename }) {
    const source = "data";
    const target = "/uploads/green-room";
    const outputName = filename || url.split('/').pop();
    await tryCreateDataDirectory(source, "/uploads");
    await tryCreateDataDirectory(source, target)

    const existingFile = (await FilePicker.browse(source, target)).files.find(f => f.includes(outputName));
    if (existingFile) {
        return existingFile;
    }

    const proxyUrl = url.toLowerCase().indexOf("http") === 0 ? "https://proxy.iungimus.de/get/" + url : url;
    const response = await fetch(proxyUrl);
    const data = await response.blob();
    const file = new File([data], outputName);
    
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
        if (current) { continue; }

        const sceneData = {
            _id: sceneId,
            name: mapTitle,
            folder: chapterDir.id,
            img: uploadLink
        }
        Utilities.setGRFlag(sceneData, "id", sceneId, { isData: true });
        await Scene.create(sceneData);
    }

    await game.scenes.render();
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
