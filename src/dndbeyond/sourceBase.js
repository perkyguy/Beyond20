class SourceBase {
    constructor(global_settings) {
        // do something here ?
        console.log(global_settings);
        this.__settings = global_settings;
    }

    getSourceName(jq) {
        return jq.parents().last().find('title').text().split(' - ')[1]
    }

    getHeader(jq) {
        return jq.find('.container h1').first();
    }

    getChapterName(jq) {
        return this.getHeader(jq).text();
    }

    getPreviousSectionName({ fromElement}) {
        fromElement.prev(`h${hLevel}`).text()
    }

    getSourceType(jq) {

    }

    getMapTitle(viewPlayerVersionLink) {
        let mapTitle = "";

        if (viewPlayerVersionLink.parent().is('.compendium-image-view-player')) {
            // PotA version
            mapTitle = viewPlayerVersionLink.parent().prev().find('.compendium-image-subtitle').text()
        } else {
            // CoS version
            mapTitle = viewPlayerVersionLink.parent().text().replace('View Player Version', '');
        }
        mapTitle = mapTitle.replace(/Map [\d\.a-z]+: /, '').trim();
        return mapTitle;
    }

    numberedSectionParser(header) {
        const [full, mapLetter, area, subArea, areaName] = $(header).text().match(/^([A-Z]?)([\d]+)([a-z]?)\. (.+)$/) || [];
        return full && { mapLetter, area, subArea, areaName};
    }

    parseText(textElement) {
        const el = $(textElement);
        const txt = el.text();
        if (el.is('p') && !el.is('.compendium-image-view-player')) {
            if (el.find('img').length > 0) {
                return el.find('img').removeClass()[0].outerHTML;
            }
            return $("<p></p>").text(txt)[0].outerHTML;
        }
        if (el.is('blockquote,aside')) {
            return $("<blockquote></blockquote>").text(txt)[0].outerHTML;
        } 
        if (el.is('figure') && !/^Map\d+/.test(el.prop('id'))) {
            return el.find('img').removeClass()[0].outerHTML;
        }
        if (el.is(':header')) {
            return $("<h2></h2>").text(txt)[0].outerHTML;
        }
        if (el.is("ul")) {
            const list = $("<ul></ul>")
            el.find("li").map((i, e) => {
                $("<li></li>", { html: $(e).append() }).appendTo(list);
            });
            return list[0].outerHTML;
        }
    }

    parseSections(sections) {
        const parsed = $(sections).get().reduce((agg, curr) => {
            if (this.numberedSectionParser(curr) || $(curr).is('h3')) {
                if (agg.currSection.content.length > 0) {
                    agg.sections.push(agg.currSection);
                }
                agg.currSection = this.numberedSectionParser($(curr)) || {areaName: $(curr).text()};
                agg.currSection.content = [];
                return agg;
            }
            agg.currSection.content.push(this.parseText(curr));
            return agg;
        }, { currSection: { areaName: 'Intro', content: []}, sections: []});
        
        if (parsed.currSection.content.length > 0) {
            parsed.sections.push(parsed.currSection);
        }

        return parsed.sections;
    }

    getMaps(jq) {
        const rootNode = this.getHeader(jq);
        const playerVersionLinks = rootNode.siblings().has(`a:contains("Player Version")`);
        const mapData = playerVersionLinks.map((i, el) => {
            const viewPlayerVersionLink = $(el).find(`a:contains("Player Version")`);
            const imageLink = viewPlayerVersionLink.prop("href");
            const lastHeader = $(el).prevAll("h2")[0];
            const mapSections = $(lastHeader).nextUntil("h2").get();
            const mapTitle = this.getMapTitle(viewPlayerVersionLink);
            const isSubMap = Boolean(this.numberedSectionParser($(el).prevAll(":header")[0]));
            const sections = !isSubMap && this.parseSections(mapSections);

            return {
                imageLink, lastHeader, mapTitle, isSubMap, sections
            }
        }).get()
        
        return mapData;
    }

    headerToHLevel(header) {
        return +($(header).get().nodeName.replace('H', ''));
    }


    parse(jq) {
        const sourceName = this.getSourceName(jq);
        const chapterName = this.getChapterName(jq);
        const maps = this.getMaps(jq);
        
        const req = { "action": "scene-import", chapterName, sourceName, maps }
        this.sendData(req);
    }
    
    sendData(req) {
        console.log("Sending message: ", req);
        chrome.runtime.sendMessage(req, (resp) => beyond20SendMessageFailure(this, resp));
    }
}