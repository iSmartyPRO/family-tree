/*
 * Registers the guided tours of project modules with the tours engine
 * (docs/extending.md → «Guided tours»). Imported once by App.jsx, so each
 * tour auto-starts on the first visit to its module. Tours of the built-in
 * pages live in tour/content.
 *
 * A new module: add modules/<id>/tour.js and list it here:
 *   import ordersTour from '../orders/tour';
 *   export const MODULE_TOURS = [ordersTour];
 */
import { registerTour } from '../../tour/engine';
import familyTour from '../family/tour';

export const MODULE_TOURS = [familyTour];

MODULE_TOURS.forEach((tour) => registerTour(tour));
