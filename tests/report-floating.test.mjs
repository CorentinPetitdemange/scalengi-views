import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ViewReport,viewRegistry,createEmptyDataset} from '../dist-module/package/scalengi-views-renderer.mjs';
// The public provider must reach the real native toolbar, rather than a host imitation.
test('floating report mode reaches the native renderer without changing the standalone default',()=>{
 const definition=viewRegistry.get('verbatim-cloud');
 const report=renderToStaticMarkup(createElement(ViewReport,{definition,data:createEmptyDataset(),locale:'fr',toolbarMode:'floating',actions:createElement('button',null,'Périmètre du host')}));
 assert.match(report,/common-view-toolbar[^\"]*is-floating/);
 assert.match(report,/Périmètre du host/);
 const normal=renderToStaticMarkup(createElement(ViewReport,{definition,data:createEmptyDataset(),locale:'fr'}));
 assert.doesNotMatch(normal,/is-floating/);
});
