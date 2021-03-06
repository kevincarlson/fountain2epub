const fs = require('fs');
const AdmZip = require('adm-zip');
const tmp = require('tmp');

const CONTENT_FOLDER = '/EPUB';

const DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const PACKAGE_PATH = 'EPUB/package.opf';

function writePackageDocument(contents, metadata, folder) {
    const packageTagOpen = '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">';
    const packageTagClose = '</package>';
    let pkg = DECLARATION + packageTagOpen + getMetadataElement(metadata) + generateManifest(contents) + generateSpine(contents) + packageTagClose;

    fs.writeFileSync(folder + '/' + PACKAGE_PATH, pkg);
}

function getMetadataElement(metadata) {
    let optionalTags = '';

    // TODO: check for all of the optional tags
    // contributor | coverage | creator | date | description | format | publisher | relation | rights | source | subject | type
    if (metadata.creator !== undefined) {
        optionalTags = optionalTags + '<dc:creator>' + metadata.creator + '</dc:creator>';
    }

    return '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' + 
           '<dc:identifier id="uid">' + metadata.title + metadata.modified + '</dc:identifier>' +
           '<dc:title>' + metadata.title + '</dc:title>' +
           '<dc:language>en</dc:language>' + // TODO: don't hard code that!
           '<meta property="dcterms:modified">' + metadata.modified + '</meta>' +
           optionalTags + '</metadata>';
}

function getManifestItems(contents) {
    let result = '';
    let item = '';
    let type = '';
    let properties = '';

    contents.forEach(element => {
        switch (element.type) {
            case 'xhtml': type = 'application/xhtml+xml'; break;
            case 'css': type = 'text/css'; break;
            case 'otf': type = 'application/vnd.ms-opentype'; break;
        }

        if (element.properties !== undefined) {
            properties = ' properties="' + element.properties + '"';
        } else {
            properties = '';
        }

        item = '<item id="' + element.id + '" href="' + element.id + '.' + element.type + '" media-type="' + type + '"' + properties + '/>';
        result = result + item;
    });

    return result;
}

function generateManifest(contents) {
    return '<manifest>' + getManifestItems(contents)  + '</manifest>';
}

function getSpineItems(contents) {
    let result = '';
    let item = '';

    contents.forEach(element => {
        if (element.type === 'xhtml') {
            result = result + '<itemref idref="' + element.id + '"/>';
        }
    });

    return result;
}

function generateSpine(contents) {
    return '<spine>' + getSpineItems(contents) + '</spine>';
}

function writeContainerFile(path) {
    fs.writeFileSync(path, '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="' + PACKAGE_PATH + '" media-type="application/oebps-package+xml"/></rootfiles></container>');
}

function writeEpubContents(folder, contents) {
    let filepath = '';

    contents.forEach(element => {
        filepath = folder + CONTENT_FOLDER + '/' + element.id + '.' + element.type;
        if (element.contentsInline) {
            fs.writeFileSync(filepath, element.fileContents);
        } else {
            fs.copyFileSync(element.path, filepath);
        }
    });

}

function createEpubFileStructure(folder) {
    fs.mkdirSync(folder + CONTENT_FOLDER);
    fs.mkdirSync(folder + '/META-INF');

    writeContainerFile(folder + '/META-INF/container.xml');
}

function addAppleDisplayOptions(folder) {
    const fileContents = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <display_options>
    <platform name="*">
    <option name="specified-fonts">true</option>
    </platform>
    </display_options>`;

    fs.writeFileSync(folder + '/META-INF/com.apple.ibooks.display-options.xml', fileContents);
}

module.exports = (filepath, epubContents, metadata) => {
    let tmpobj = tmp.dirSync();
    let tmpdir = tmpobj.name;
    let zip = new AdmZip('../res/base.epub');

    createEpubFileStructure(tmpdir);
    writePackageDocument(epubContents, metadata, tmpdir);
    writeEpubContents(tmpdir, epubContents);
    addAppleDisplayOptions(tmpdir);

    zip.addLocalFolder(tmpdir);
    zip.writeZip(filepath);
}