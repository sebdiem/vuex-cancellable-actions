/*
 * Creates a string that can be used for dynamic id attributes
 * Example: "id-so7567s1pcpojemi"
 * @param prefix {string}
 * @returns {string}
 */
function uniqueId (prefix) {
  return (prefix || '') + Math.random().toString(36).substr(2, 16)
}

function isPromise (val) {
  return val && typeof val.then === 'function'
}

class ActionCancelledError extends Error {
  constructor (message) {
    super(message)
    this.message = message
    this.name = 'ActionCancelledError'
  }
}

function actionCancellerFactory () {
  const cancelledActions = new Set()
  return {
    cancelAction (actionId) {
      cancelledActions.add(actionId)
    },
    isActionCancelled (actionId) {
      return cancelledActions.has(actionId)
    },
    cleanAction (actionId) {
      cancelledActions.delete(actionId)
    },
  }
}
const actionCanceller = actionCancellerFactory()

function actionWrapper (action) {
  return async function (context, ...args) {
    const isRootAction = !context.rootActionId
    context.rootActionId = context.rootActionId || uniqueId('action-')
    const rootActionId = context.rootActionId
    const { commit, dispatch } = context

    context.commit = function wrappedCommit (...args) {
      if (actionCanceller.isActionCancelled(rootActionId)) {
        throw new ActionCancelledError()
      }
      return commit(...args)
    }

    context.dispatch = function wrappedDispatch (...args) {
      if (actionCanceller.isActionCancelled(rootActionId)) {
        throw new ActionCancelledError()
      }
      return dispatch(...args)
    }

    // handle async And sync actions
    let ret = action.call(this, context, ...args)
    if (!isPromise(ret)) ret = Promise.resolve(ret)
    await ret
    if (isRootAction) {
      actionCanceller.cleanAction(rootActionId)
    }
    return ret
  }
}

/* Add a unique identifier `rootActionId` to the context of
 * each action, which is passed to subsequent calls to dispatch
 * or commit.
 * This enables to cancel an action by preventing it to further
 * commit to the store, using the cancelAction below.
 *
 * Note: commits already performed won't be undone.
 */
export function makeCancellable (actions) {
  return Object.keys(actions).reduce(
    (acc, key) => {
      acc[key] = actionWrapper(actions[key])
      return acc
    },
    {}
  )
}

/* Cancel an action that was made cancellable by the wrapper above.
 *
 * Note: commits already performed won't be undone.
 */
export function cancelAction (actionId) {
  actionCanceller.cancelAction(actionId)
}

/* `takeLatest` enables to decorate an action to guarantee that
 * only the last call is running at any time.
 * As soon as a new call is triggered the previous call commits
 * are guaranteed to be ignored (even if they happen later on due
 * to asynchronicity).
 *
 * Note: this function requires all involved actions to be made
 * cancellable by the makeCancellable function.
 * Note: commits already performed are never undone.
 */
export function takeLatest (action) {
  const previousCalls = []
  return async function takeLatestActionWrapper (context, ...args) {
    while (previousCalls.length > 0) {
      cancelAction(previousCalls.pop())
    }
    previousCalls.push(context.rootActionId)
    try {
      return await action.call(this, context, ...args)
    } catch (e) {
      if (e.name !== 'ActionCancelledError') throw e
    }
  }
}
