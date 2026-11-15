// Generated from 03-Src/studio/project-sandbox/idle-orbit.ts; run node tools/sync-office-motion.mjs.
/** One cancellable deadline, reset by real input; never accumulate hidden-page time. */
export function createIdleOrbit(change, canStart, clock) {
    let options = { enabled: false, blocked: true, delay: 15000 }, timer, armed = false, running = false, held = false, disposed = false;
    function stop() { if (armed)
        clock.clear(timer); armed = false; if (running) {
        running = false;
        change(false);
    } }
    function reset() { stop(); if (disposed || !options.enabled || options.blocked || held)
        return; armed = true; timer = clock.set(() => { armed = false; if (disposed || held || options.blocked)
        return; if (!canStart()) {
        armed = true;
        timer = clock.set(reset, 250);
        return;
    } running = true; change(true); }, options.delay); }
    return { configure(next) { options = next; reset(); }, activity: reset, hold(value) { held = value; reset(); }, dispose() { disposed = true; stop(); } };
}
