export const checkForAlpine = () => {
    if (!window.Alpine) {
        throw new Error('[Magic Helpers] Alpine is required for the magic helpers to function correctly.')
    }
    if (!window.Alpine.version || !isValidVersion('2.5.0', window.Alpine.version)) {
        throw new Error('Invalid Alpine version. Please use Alpine version 2.5.0 or above')
    }
}

export const syncWithObservedComponent = function (data, observedComponent, callback) {
    if (!observedComponent.getAttribute('x-bind:data-last-refresh')) {
        observedComponent.setAttribute('x-bind:data-last-refresh', 'Date.now()')
    }
    const handler = (scope = null) => {
        return {
            get(target, key) {
                if (target[key] !== null && typeof target[key] === 'object') {
                    const path = scope ? `${scope}.${key}` : key
                    return new Proxy(target[key], handler(path))
                }
                return target[key]
            },
            set(_target, key, value) {
                if (!observedComponent.__x) {
                    throw new Error('Error communicating with observed component')
                }
                const path = scope ? `${scope}.${key}` : key
                callback.call(observedComponent, observedComponent.__x.$data, path, value)
                return true
            },
        }
    }
    return new Proxy(data, handler())
}

export const updateOnMutation = function (componentBeingObserved, callback) {
    if (!componentBeingObserved.getAttribute('x-bind:data-last-refresh')) {
        componentBeingObserved.setAttribute('x-bind:data-last-refresh', 'Date.now()')
    }
    const observer = new MutationObserver(mutations => {
        for (let i = 0; i < mutations.length; i++) {
            const mutatedComponent = mutations[i].target.closest('[x-data]')
            if (mutatedComponent && !mutatedComponent.isSameNode(componentBeingObserved)) continue
            callback()
            return
        }
    })
    observer.observe(componentBeingObserved, {
        attributes: true,
        childList: true,
        subtree: true,
    })
}

// Borrowed from https://stackoverflow.com/a/54733755/1437789
export const objectSetDeep = function (object, path, value) {
    path = path.toString().match(/[^.[\]]+/g) || []
    // Iterate all of them except the last one
    path.slice(0, -1).reduce((a, currentKey, index) => {
        // If the key does not exist or its value is not an object, create/override the key
        if (Object(a[currentKey]) !== a[currentKey]) {
            // Is the next key a potential array-index?
            a[currentKey] = Math.abs(path[index + 1]) >> 0 === +path[index + 1]
                ? [] // Yes: assign a new array object
                : {} // No: assign a new plain object
        }
        return a[currentKey]
    }, object)[path[path.length - 1]] = value // Finally assign the value to the last key
    return object
}

// Returns component data if Alpine has made it available, otherwise computes it with saferEval()
export const componentData = function (component) {
    if (component.__x) {
        return component.__x.getUnobservedData()
    }
    return saferEval(component.getAttribute('x-data'), component)
}

function isValidVersion(required, current) {
    const requiredArray = required.split('.')
    const currentArray = current.split('.')
    for (let i = 0; i < requiredArray.length; i++) {
        if (!currentArray[i] || parseInt(currentArray[i]) < parseInt(requiredArray[i])) {
            return false
        }
    }
    return true
}

function saferEval(expression, dataContext, additionalHelperVariables = {}) {
    if (typeof expression === 'function') {
        return expression.call(dataContext)
    }

    // eslint-disable-next-line no-new-func
    return (new Function(['$data', ...Object.keys(additionalHelperVariables)], `var __alpine_result; with($data) { __alpine_result = ${expression} }; return __alpine_result`))(
        dataContext, ...Object.values(additionalHelperVariables),
    )
}
