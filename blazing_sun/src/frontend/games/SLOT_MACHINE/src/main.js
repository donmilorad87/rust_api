/**
 * SLOT_MACHINE Game Entry Point
 *
 * This file bootstraps the Slot Machine game web component.
 * Imports styles and registers the custom element.
 */

import './styles/main.scss';
import { SlotMachine } from './SlotMachine.js';

// Register the web component
if (!customElements.get('slot-machine')) {
    customElements.define('slot-machine', SlotMachine);
}

console.log('[SLOT_MACHINE] Web component registered');
