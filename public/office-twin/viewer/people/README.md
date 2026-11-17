# Office character adapter

The model builder is adapted from [khanh020905/my-office](https://github.com/khanh020905/my-office/blob/b68228871fe30cd2c759a2c919337a9a9d1f5644/src/office/people/chibi-rig.js), commit `b68228871fe30cd2c759a2c919337a9a9d1f5644`, under MIT. The complete copyright and license are in `LICENSE.my-office.txt`.

`chibi-model.js` retains the original default stylised character proportions, face, clothing and hair geometry. It omits the upstream world, translations, browser preferences, props and task logic. Hair tessellation is reduced from 160×40 to 80×24 while keeping its sculpted profile. Three.js RoundedBoxGeometry uses the existing vendored Three.js r186 and its MIT license.

`batch-rig.js` uses rigid GPU skinning and vertex colours to batch details by material properties across joints; original surface types, roughness and eye/hair highlights remain. Resources are released when a roster is rebuilt or the viewer is disposed.

`../seated-person.js` uniformly scales the model by 0.86, translates it to the chair and targets the actual keyboard with fixed-length arm IK. Thighs and shins remain 0.24 reference units each, independent of seat height. The Astra activity clock, opposite hand/foot gait, pickup, ray picking and review-selection interface remain the host's responsibility.

`appearances.js` exposes 12 curated combinations of the same upstream hair, clothing and accessory geometry, using palette and style choices from [`workers.js`](https://github.com/khanh020905/my-office/blob/b68228871fe30cd2c759a2c919337a9a9d1f5644/src/office/people/workers.js) and the suit from [`director.js`](https://github.com/khanh020905/my-office/blob/b68228871fe30cd2c759a2c919337a9a9d1f5644/src/office/people/director.js). Both share the MIT license above. Chinese option names and the combinations are Astra's selection UI, not named upstream characters. No upstream identities, task behaviours, trademarks or external services are imported.

Per-person `appearance` defaults to `inherit` (the saved global style). Explicit choices use this chibi rig independently of global Polyfork styles. `appearance-preview.js` draws only on selection changes and releases its temporary renderer when settings close.

Astra 自行扩展黑长直与大波浪发型，提供米白、浅紫、奶油、豆沙四款连衣裙搭配；这些扩展不声称来自上游。裙摆使用既有骨架体系的一根附加骨骼，随起坐转动、走路轻摆，悬提时自然下垂；不引入布料或头发物理模拟。
