/*
 * Alice's Simple Mind Maps
 * Copyright (C) 2026 Miss Alice & Saidone
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const scripts = path.join(__dirname, '../../main/resources/static/js');

class Element {
    constructor() { this.children = []; this.style = {}; this.dataset = {}; this.attributes = {}; this.value = '100'; }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    replaceChildren() { this.children = []; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener() {}
    remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); }
}
function setup(responses) {
    const ids = Object.fromEntries(['game-board', 'game-images', 'game-feedback', 'game-stats', 'start-game', 'game-zoom'].map(id => [id,new Element()]));
    const calls = [];
    let ticks = 0;
    const context = vm.createContext({
        document: {getElementById: id => ids[id], createElement: () => new Element(), createElementNS: () => new Element()},
        location: {pathname:'/play/token'}, Date, console,
        setInterval: () => ++ticks, clearInterval: id => { if (id) --ticks; },
        fetch: async (url, options) => { calls.push({url,body:JSON.parse(options.body)}); return responses.shift(); }
    });
    vm.runInContext(fs.readFileSync(path.join(scripts,'map-geometry.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(path.join(scripts,'map-game.js'),'utf8'),context);
    return {ids,context,calls,ticks:()=>ticks};
}
const response = body => ({ok:true,json:async()=>body});
const board = () => ({runId:'run',map:{nodes:[{id:1,text:'Gatto',description:'Fa le fusa',imageUri:'pending',x:100,y:100,fontSize:18},{id:2,parentId:1,text:'Tema',x:500,y:100}]},images:[{id:'cat',uri:'cat.png'}]});
const flush = () => new Promise(resolve => setImmediate(resolve));

test('selecting, wrong hint, keyboard placement and final score', async () => {
    const app = setup([response(board()), response({correct:false,hint:'Fa le fusa',matched:0,total:1,attempts:1,errors:1,seconds:1,complete:false}), response({correct:true,matched:1,total:1,attempts:2,errors:1,seconds:2,score:1000,complete:true})]);
    await app.ids['start-game'].onclick();
    assert.equal(app.ids['game-images'].children.length,1);
    assert.equal(app.ticks(),0);
    const group = app.ids['game-board'].children.find(el => el.attributes.role === 'button');
    app.ids['game-images'].children[0].onclick();
    await group.onclick();
    assert.match(app.ids['game-feedback'].textContent,/Suggerimento: Fa le fusa/);
    assert.equal(app.ids['game-images'].children.length,1);
    group.onkeydown({key:'Enter',preventDefault(){}});
    await flush();
    assert.equal(app.ids['game-images'].children.length,0);
    assert.match(app.ids['game-feedback'].textContent,/1000 punti/);
    assert.match(app.ids['game-stats'].textContent,/1\/1 immagini al loro posto/);
    assert.equal(app.ticks(),0);
    assert.equal(app.calls[1].body.imageId,'cat');
    assert.equal(app.calls[1].body.nodeId,1);
    assert.equal(app.calls[1].body.runId,'run');
});

test('failed start can be retried and dragging selects the image', async () => {
    const app = setup([{ok:false,status:404}, response(board())]);
    await app.ids['start-game'].onclick();
    assert.match(app.ids['game-feedback'].textContent,/non è più disponibile/);
    assert.equal(app.ids['start-game'].disabled,false);
    await app.ids['start-game'].onclick();
    let dragged;
    app.ids['game-images'].children[0].ondragstart({dataTransfer:{setData:(type,id)=>dragged=id}});
    assert.equal(dragged,'cat');
    assert.equal(app.ids['game-images'].children[0].attributes['aria-pressed'],'true');
});

test('placeholder keeps original image node dimensions and custom sizes', () => {
    const app = setup([]);
    const size = vm.runInContext('getNodeSize({text:"Gatto", imageUri:"pending", imageWidth:128,imageHeight:128,fontSize:18})',app.context);
    assert.equal(size.width,220);
    assert.equal(size.height,216);
    const custom = vm.runInContext('getNodeSize({text:"Gatto", imageUri:"pending",nodeWidth:400,nodeHeight:320})',app.context);
    assert.equal(custom.width,400); assert.equal(custom.height,320);
});
