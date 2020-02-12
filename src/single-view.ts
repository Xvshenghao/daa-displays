/**
 * ## Notices
 * Copyright 2019 United States Government as represented by the Administrator 
 * of the National Aeronautics and Space Administration. All Rights Reserved.
 * 
 * ## Disclaimers
 * No Warranty: THE SUBJECT SOFTWARE IS PROVIDED "AS IS" WITHOUT ANY WARRANTY OF ANY KIND, 
 * EITHER EXPRESSED, IMPLIED, OR STATUTORY, INCLUDING, BUT NOT LIMITED TO, ANY WARRANTY 
 * THAT THE SUBJECT SOFTWARE WILL CONFORM TO SPECIFICATIONS, ANY IMPLIED WARRANTIES OF 
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR FREEDOM FROM INFRINGEMENT, 
 * ANY WARRANTY THAT THE SUBJECT SOFTWARE WILL BE ERROR FREE, OR ANY WARRANTY THAT 
 * DOCUMENTATION, IF PROVIDED, WILL CONFORM TO THE SUBJECT SOFTWARE. THIS AGREEMENT DOES NOT, 
 * IN ANY MANNER, CONSTITUTE AN ENDORSEMENT BY GOVERNMENT AGENCY OR ANY PRIOR RECIPIENT 
 * OF ANY RESULTS, RESULTING DESIGNS, HARDWARE, SOFTWARE PRODUCTS OR ANY OTHER APPLICATIONS 
 * RESULTING FROM USE OF THE SUBJECT SOFTWARE.  FURTHER, GOVERNMENT AGENCY DISCLAIMS 
 * ALL WARRANTIES AND LIABILITIES REGARDING THIRD-PARTY SOFTWARE, IF PRESENT IN THE 
 * ORIGINAL SOFTWARE, AND DISTRIBUTES IT "AS IS."
 * 
 * Waiver and Indemnity:  RECIPIENT AGREES TO WAIVE ANY AND ALL CLAIMS AGAINST THE 
 * UNITED STATES GOVERNMENT, ITS CONTRACTORS AND SUBCONTRACTORS, AS WELL AS ANY PRIOR 
 * RECIPIENT.  IF RECIPIENT'S USE OF THE SUBJECT SOFTWARE RESULTS IN ANY LIABILITIES, 
 * DEMANDS, DAMAGES, EXPENSES OR LOSSES ARISING FROM SUCH USE, INCLUDING ANY DAMAGES 
 * FROM PRODUCTS BASED ON, OR RESULTING FROM, RECIPIENT'S USE OF THE SUBJECT SOFTWARE, 
 * RECIPIENT SHALL INDEMNIFY AND HOLD HARMLESS THE UNITED STATES GOVERNMENT, 
 * ITS CONTRACTORS AND SUBCONTRACTORS, AS WELL AS ANY PRIOR RECIPIENT, TO THE EXTENT 
 * PERMITTED BY LAW.  RECIPIENT'S SOLE REMEDY FOR ANY SUCH MATTER SHALL BE THE IMMEDIATE, 
 * UNILATERAL TERMINATION OF THIS AGREEMENT.
 */

import { AirspeedTape } from './daa-displays/daa-airspeed-tape';
import { AltitudeTape } from './daa-displays/daa-altitude-tape';
import { VerticalSpeedTape } from './daa-displays/daa-vertical-speed-tape';
import { Compass } from './daa-displays/daa-compass';
import { HScale } from './daa-displays/daa-hscale';

import { InteractiveMap } from './daa-displays/daa-interactive-map';
import { DAAPlayer } from './daa-displays/daa-player';
import { LLAData, ConfigData, MonitorElement, MonitorData } from './daa-displays/utils/daa-server';

import * as utils from './daa-displays/daa-utils';
import { ViewOptions } from './daa-displays/daa-view-options';

const player: DAAPlayer = new DAAPlayer();

function render (data: { map: InteractiveMap, compass: Compass, airspeedTape: AirspeedTape, altitudeTape: AltitudeTape, verticalSpeedTape: VerticalSpeedTape }) {
    const daaSymbols = [ "daa-target", "daa-traffic-monitor", "daa-traffic-avoid", "daa-alert" ]; // 0..3
    const flightData: LLAData = <LLAData> player.getCurrentFlightData();
    data.map.setPosition(flightData.ownship.s);
    data.compass.setCompass(flightData.ownship.v);
    const hd: number = Compass.v2deg(flightData.ownship.v);
    const gs: number = AirspeedTape.v2gs(flightData.ownship.v);
    data.airspeedTape.setAirSpeed(gs, AirspeedTape.units.knots);
    const vs: number = +flightData.ownship.v.z / 100; // airspeed tape units is 100fpm
    data.verticalSpeedTape.setVerticalSpeed(vs);
    const alt: number = +flightData.ownship.s.alt;
    data.altitudeTape.setAltitude(alt, AltitudeTape.units.ft);
    // console.log(`Flight data`, flightData);
    const bands: utils.DAABandsData = player.getCurrentBands();
    if (bands) {
        data.compass.setBands(bands["Heading Bands"]);
        data.airspeedTape.setBands(bands["Horizontal Speed Bands"], AirspeedTape.units.knots);
        data.verticalSpeedTape.setBands(bands["Vertical Speed Bands"]);
        data.altitudeTape.setBands(bands["Altitude Bands"], AltitudeTape.units.ft);
        // set resolutions
        data.compass.setBug(bands["Heading Resolution"]);
        data.airspeedTape.setBug(bands["Horizontal Speed Resolution"]);
        data.altitudeTape.setBug(bands["Altitude Resolution"]);
    }
    const traffic = flightData.traffic.map((data, index) => {
        const alert: number = (bands && bands.Alerts && bands.Alerts[index]) ? +bands.Alerts[index].alert : 0;
        return {
            callSign: data.id,
            s: data.s,
            v: data.v,
            symbol: daaSymbols[alert]
        }
    });
    data.map.setTraffic(traffic);
    const step: number = player.getCurrentSimulationStep();
    const time: string = player.getCurrentSimulationTime();
    plot({ ownship: { gs, vs, alt, hd }, bands, step, time });
}

const daaPlots: { id: string, name: string, units: string }[] = [
    { id: "heading-bands", units: "deg", name: "Heading Bands" },
    { id: "horizontal-speed-bands", units: "knot", name: "Horizontal Speed Bands" },
    { id: "vertical-speed-bands", units: "fpm", name: "Vertical Speed Bands" },
    { id: "altitude-bands", units: "ft", name: "Altitude Bands" }
];

function plot (desc: { ownship: { gs: number, vs: number, alt: number, hd: number }, bands: utils.DAABandsData, step: number, time: string }) {
    // FIXME: band.id should be identical to band.name
    player.getPlot("alerts").plotAlerts({
        alerts: desc.bands["Alerts"],
        step: desc.step,
        time: desc.time
    });
    for (let i = 0; i < daaPlots.length; i++) {
        const marker: number = (daaPlots[i].id === "heading-bands") ? desc.ownship.hd
                                : (daaPlots[i].id === "horizontal-speed-bands") ? desc.ownship.gs
                                : (daaPlots[i].id === "vertical-speed-bands") ? desc.ownship.vs * 100
                                : (daaPlots[i].id === "altitude-bands") ? desc.ownship.alt
                                : null;
        const resolution: number = (daaPlots[i].id === "heading-bands" && desc.bands["Heading Resolution"]) ? +desc.bands["Heading Resolution"]["val"]
                                : (daaPlots[i].id === "horizontal-speed-bands" && desc.bands["Horizontal Speed Resolution"]) ? +desc.bands["Horizontal Speed Resolution"]["val"]
                                : (daaPlots[i].id === "vertical-speed-bands" && desc.bands["Vertical Speed Resolution"]) ? +desc.bands["Vertical Speed Resolution"]["val"]
                                : (daaPlots[i].id === "altitude-bands" && desc.bands["Altitude Resolution"]) ? +desc.bands["Altitude Resolution"]["val"]
                                : null;
        player.getPlot(daaPlots[i].id).plotBands({
            bands: desc.bands[daaPlots[i].name],
            step: desc.step,
            time: desc.time,
            units: daaPlots[i].units,
            marker,
            resolution
        });
    }
}

function plotMonitor (desc: { data: MonitorElement, monitorID: number }) {
    if (desc && desc.data && desc.data.results && desc.data.results.length) {
        const results: MonitorData[] = desc.data.results;
        const len: number = player.getSimulationLength();
        for (let step = 0; step < len; step++) {
            const time: string = player.getTimeAt (step);
            for (let p = 0; p < daaPlots.length; p++) {
                if (results[step] && step < results.length) {
                    const key: string = daaPlots[p].name.replace(" Bands", "");
                    const color: string = results[step].details[`${key}`];
                    const plotID: string = daaPlots[p].id;
                    player.getPlot(plotID).deleteMarker(step);
                    if (color !== "green") {
                        const legend: string = desc.data.legend[color];
                        player.getPlot(plotID).revealMarker({ step, tooltip: `Time ${time}<br>${legend}`, color, header: `Monitor ${desc.monitorID}` });
                    }
                }
            }
        }
    }
}

// single player
const map: InteractiveMap = new InteractiveMap("map", { top: 2, left: 6}, { parent: "daa-disp" });
// map heading is controlled by the compass
const compass: Compass = new Compass("compass", { top: 110, left: 215 }, { parent: "daa-disp", map: map });
// map zoom is controlled by nmiSelector
const hscale: HScale = new HScale("hscale", { top: 800, left: 13 }, { parent: "daa-disp", map: map });
// map view options
const viewOptions: ViewOptions = new ViewOptions("view-options", { top: 4, left: 13 }, { parent: "daa-disp", compass, map });
// create remaining display widgets
const airspeedTape = new AirspeedTape("airspeed", { top: 100, left: 100 }, { parent: "daa-disp" });
const altitudeTape = new AltitudeTape("altitude", { top: 100, left: 600 }, { parent: "daa-disp" });
const verticalSpeedTape = new VerticalSpeedTape("vertical-speed", {top: 210, left: 600 }, { parent: "daa-disp", verticalSpeedRange: 2000 });

player.define("step", async () => {
    render({
        map: map, compass: compass, airspeedTape: airspeedTape, 
        altitudeTape: altitudeTape, verticalSpeedTape: verticalSpeedTape
    });
});
player.define("init", async () => {
    // compute java output
    await player.exec({
        alertingLogic: player.getSelectedWellClearVersion(), //"DAAtoPVS-1.0.1.jar",
        alertingConfig: player.getSelectedConfiguration(),
        scenario: player.getSelectedScenario()
    });
    viewOptions.applyCurrentViewOptions();
    player.updateMonitors();
});
async function developerMode (): Promise<void> {
    const configData: ConfigData = await player.loadSelectedConfiguration();

    airspeedTape.setUnits(configData["horizontal-speed"].units);
    airspeedTape.setRange(configData["horizontal-speed"]);
    airspeedTape.revealUnits();
    airspeedTape.disableTapeSpinning();

    altitudeTape.setUnits(configData.altitude.units);
    altitudeTape.setRange(configData["altitude"]);
    altitudeTape.revealUnits();
    altitudeTape.disableTapeSpinning();
}
//fixme: don't use DAABandsData[], replace it with DaidalusBandsDescriptor
player.define("plot", () => {
    const bandsData: utils.DAABandsData[] = player.getBandsData();
    const flightData: LLAData[] = player.getFlightData();
    if (bandsData) {
        for (let step = 0; step < bandsData.length; step++) {
            player.setTimerJiffy("plot", () => {
                const lla: LLAData = flightData[step];
                const hd: number = Compass.v2deg(lla.ownship.v);
                const gs: number = AirspeedTape.v2gs(lla.ownship.v);
                const vs: number = +lla.ownship.v.z / 100;
                const alt: number = +lla.ownship.s.alt;
                plot({ ownship: {hd, gs, vs, alt }, bands: bandsData[step], step, time: player.getTimeAt(step) });   
            }, step);
        }
        // const monitorID: number = 2;
        // plotMonitor({
        //     data: bandsData[0].Monitors[monitorID],
        //     monitorID
        // });
    }
});
async function createPlayer() {
    player.appendSimulationPlot({
        id: "alerts",
        width: 1100,
        label: "Alerts",
        range: { from: 1, to: 3 },
        parent: "simulation-plot"
    });
    player.appendSimulationPlot({
        id: "heading-bands",
        top: 150,
        width: 1100,
        label: "Heading Bands",
        range: { from: 0, to: 360 },
        units: "[deg]",
        parent: "simulation-plot"
    });
    player.appendSimulationPlot({
        id: "horizontal-speed-bands",
        top: 300,
        width: 1100,
        label: "Horizontal Speed Bands",
        range: { from: 0, to: 1000 },
        units: "[knot]",
        parent: "simulation-plot"
    });
    player.appendSimulationPlot({
        id: "vertical-speed-bands",
        top: 450,
        width: 1100,
        label: "Vertical Speed Bands",
        range: { from: -10000, to: 10000 },
        units: "[fpm]",
        parent: "simulation-plot"
    });
    player.appendSimulationPlot({
        id: "altitude-bands",
        top: 600,
        width: 1100,
        label: "Altitude Bands",
        range: { from: -200, to: 60000 },
        units: "[ft]",
        parent: "simulation-plot"
    });
    player.appendNavbar();
    player.appendSidePanelView();
    await player.appendScenarioSelector();
    await player.appendWellClearVersionSelector();
    await player.appendWellClearConfigurationSelector();
    await player.appendMonitorPanel();
    // handlers can be defined only after creating the monitor panel
    for (let i = 0; i < 3; i++) {
        const monitorID: number = i + 1;
        player.on(`click.monitor-${monitorID}`, () => {
            const bandsData: utils.DAABandsData[] = player.getBandsData();
            // const flightData: LLAData[] = player.getFlightData();
            if (bandsData && bandsData.length) {
                plotMonitor({
                    data: bandsData[0].Monitors[i],
                    monitorID
                });
            }
        });
    }
    player.appendSimulationControls({
        parent: "simulation-controls",
        displays: [ "daa-disp" ]
    });
    player.appendPlotControls({
        parent: "simulation-controls",
        top: 60
    });
    player.appendActivationPanel({
        parent: "activation-controls",
        width: 1072
    });
    await player.activate();
    developerMode();
}
createPlayer();
