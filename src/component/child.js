
import { Promise } from 'es6-promise-min';
import postRobot from 'post-robot';
import { noop, once, extend } from '../util';
import { CONSTANTS } from '../constants';

export class ChildComponent {

    constructor(component, options = {}) {
        this.validate(options);

        this.component = component;

        this.onEnter = once(options.onEnter || noop);
        this.onExit = once(options.onExit || noop);
        this.onClose = once(options.onClose || noop);
        this.onError = once(options.onError || noop);

        this.onProps = options.onProps || noop;

        this.listen();

        this.props = {};

        this.parent = window.opener || window.parent;

        this.initPromise = postRobot.sendToParent(CONSTANTS.POST_MESSAGE.INIT).then(data => {

            this.context = data.context;
            extend(this.props, data.props);

            this.onEnter.call(this);
            this.onProps.call(this);

        }).catch(err => this.onError(err));

        this.setupCallbacks();
    }

    validate(options) {
        // pass
    }

    setupCallbacks() {
        for (let key of Object.keys(this.component.props)) {
            let prop = this.component.props[key];

            if (prop.type === 'function') {
                this.props[key] = function() {
                    let args = Array.prototype.slice.call(arguments);

                    try {
                        JSON.stringify(args);
                    } catch (err) {
                        throw new Error(`Can not serialize arguments passed to props.${key}`);
                    }

                    return postRobot.sendToParent(CONSTANTS.POST_MESSAGE.PROP_CALLBACK, {
                        key: key,
                        args: args
                    });
                }
            }
        }
    }

    listen() {
        postRobot.on(CONSTANTS.POST_MESSAGE.PROPS, { window: this.parent }, data => {
            extend(this.props, data.props);
            this.onProps.call(this);
        });

        postRobot.on(CONSTANTS.POST_MESSAGE.CLOSE, { window: this.parent }, data => {
            this.onClose.call(this);
        });

        postRobot.on(CONSTANTS.POST_MESSAGE.RESIZE, { window: this.parent }, data => {
            window.resizeTo(data.width, data.height);
        });
    }

    close() {
        return postRobot.sendToParent(CONSTANTS.POST_MESSAGE.CLOSE);
    }

    focus() {
        return postRobot.sendToParent(CONSTANTS.POST_MESSAGE.FOCUS);
    }

    resize(height, width) {
        return Promise.resolve().then(() => {

            if (this.context === CONSTANTS.CONTEXT.POPUP) {
                window.resizeTo(width, height);

            } else if (this.context === CONSTANTS.CONTEXT.IFRAME) {
                return postRobot.sendToParent(CONSTANTS.POST_MESSAGE.RESIZE, {
                    height: height,
                    width: width
                });
            }
        });
    }

    redirectParent(url) {

        function redirect() {
            setTimeout(() => {
                if (window.opener) {
                    window.opener.location = url;
                } else if (window.parent) {
                    window.parent.location = url;
                }
            });
        }

        return postRobot.sendToParent(CONSTANTS.POST_MESSAGE.REDIRECT, {
            url: url
        }).then(function() {
            console.warn('Parent did not redirect');
            redirect();
        }, function(err) {
            console.warn('Parent did not redirect due to error', err.stack || err.toString());
            redirect();
        });
    }
}