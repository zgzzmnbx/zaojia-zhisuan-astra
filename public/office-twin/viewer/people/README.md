# Office character adapter

The model builder is adapted from [khanh020905/my-office](https://github.com/khanh020905/my-office/blob/b68228871fe30cd2c759a2c919337a9a9d1f5644/src/office/people/chibi-rig.js), commit `b68228871fe30cd2c759a2c919337a9a9d1f5644`, under MIT. The complete copyright and license are in `LICENSE.my-office.txt`.

`chibi-model.js` retains the original default stylised character proportions, face, clothing and hair geometry. It omits the upstream world, translations, browser preferences, props and task logic. Hair tessellation is reduced from 160×40 to 80×24 while keeping its sculpted profile. Three.js RoundedBoxGeometry uses the existing vendored Three.js r186 and its MIT license.

`batch-rig.js` uses rigid GPU skinning and vertex colours to batch details by material properties across joints; original surface types, roughness and eye/hair highlights remain. Resources are released when a roster is rebuilt or the viewer is disposed.

`../seated-person.js` uniformly scales the model by 0.86, translates it to the chair and targets the actual keyboard with fixed-length arm IK. Thighs and shins remain 0.24 reference units each, independent of seat height. The Astra activity clock, opposite hand/foot gait, pickup, ray picking and review-selection interface remain the host's responsibility.
