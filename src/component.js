import { createLifecycle, runHook } from "./lifecycle.js";
import { initPropsAndObserve } from "./props.js";
import { initDispatch } from "./events.js";
import { createFragment } from "./utils/dom.js";
import { handleError as error } from "./utils/error.js";

const REGEX_TAG_NAME = /^[a-z][a-z0-9-]*$/;
const SHADOW_MODE = "open"; // closed || open

/**
 * A base class for creating custom elements that provides an API for working
 * with properties, events, and the component lifecycle.
 *
 * @param {function} [setup] An optional function that is called when the
 *     component is initialized. It is passed the component's properties as an
 *     argument and should return a value that can be rendered into the
 *     component's shadow DOM.
 * @param {object} [options] An optional object with options for the component.
 *     Currently only the `mode` option is supported, which can be either
 *     `"open"` or `"closed"` and determines whether the component's shadow DOM
 *     is open or closed.
 *
 * @returns {class} A class that extends `HTMLElement` and provides the
 *     following additional properties and methods:
 *
 *     - `#shadow`: The component's shadow DOM.
 *     - `props`: An object containing the component's properties.
 *     - `_cleanup`: An array of functions that are called when the component is
 *         destroyed.
 *     - `_isMounted`: A boolean indicating whether the component is currently
 *         mounted.
 *     - `constructor()`: Initializes the component and calls the `setup`
 *         function if it is provided.
 *     - `connectedCallback()`: Called when the component is inserted into the
 *         DOM. It calls the `mount` lifecycle hook if the component is already
 *         mounted.
 *     - `disconnectedCallback()`: Called when the component is removed from the
 *         DOM. It calls the `destroy` lifecycle hook and then calls the
 *         functions in the `_cleanup` array.
 */
const BaseComponent = (setup, options = {}) =>
    class extends HTMLElement {
        #shadow = this.attachShadow({ mode: options.mode || SHADOW_MODE });
        #mounted = false;
        props = Object.create(null);
        _lifecycles = {
            beforeMount: [],
            mount: [],
            beforeUpdate: [],
            update: [],
            destroy: [],
        };
        _cleanup = [];

        constructor() {
            super();
            queueMicrotask(() => {
                // Initialize component
                createLifecycle(this);
                initDispatch(this);
                initPropsAndObserve(this);

                // Call setup function with props and render result
                const result = setup?.call(this, this.props);
                createFragment(result || [result], null, this.#shadow);

                runHook("beforeMount");
            });
        }

        connectedCallback() {
            if (this.#mounted) return;
            this.#mounted = true;
            runHook("mount");
        }

        disconnectedCallback() {
            runHook("destroy");
            this._cleanup.forEach((cleanup) => cleanup());
            this._cleanup = [];
            this.#mounted = false;
        }
    };

/**
 * Registers a custom element with the given tag name and setup function.
 *
 * @param {string} tagName The tag name of the custom element.
 * @param {function} [setup] An optional function that is called when the
 *     component is initialized. It is passed the component's properties as an
 *     argument and should return a value that can be rendered into the
 *     component's shadow DOM.
 * @param {object} [options] An optional object with options for the component.
 *     Currently only the `mode` option is supported, which can be either
 *     `"open"` or `"closed"` and determines whether the component's shadow DOM
 *     is open or closed.
 *
 * @returns {undefined}
 */
export const component = (tagName, setup, options = {}) => {
    if (typeof customElements == "undefined") return;
    if (!REGEX_TAG_NAME.test(tagName))
        return error("component", `Invalid tag name: ${tagName}`, "error");
    if (customElements.get(tagName))
        return error("component", `${tagName} already registered`, "warn");

    // Register the component
    customElements.define(tagName, BaseComponent(setup, options));
};
