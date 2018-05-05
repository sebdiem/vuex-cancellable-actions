# vuex-cancellable-actions

This repository provides a wrapper around your vuex actions to allow the
cancellation of an ongoing action. For the moment the only API function
implemented is `takeLatest` which automatically cancels every past actions as
soon as a new instance of the action is dispatched.

## Usage

Wrap all your actions with `makeCancellable` and use the `takeLatest` wrapper
around actions that should not be run in parallel.

```javascript
new Vuex.Store({
  …
  actions: makeCancellable({
    action1: takeLatest(async function ({ commit, dispatch }, data) {
      dispatch('action2', data.subData)
      commit('commit1', data)
    }),
    action2: function (data) {
      commit('commit2', data)
    },
  })
})
```

## Use case

After triggering an async action (let's name it action1), you may want to
cancel it because a more recent action (action2) has occured and you don't want
"action1" to keep on committing to the store while "action2" is also commiting.
This could indeed lead to an inconsistent store.

To make things a bit less abstract let's consider the following scenario. Your
vuejs application is loading and displaying a bunch of books and these
books are filtered based on the menu selected by the user (e.g. read VS
unread books).
You have defined an action like:

```javascript
async loadBooks ({ commit }, booksState) {
  const data = await apiCall(booksState)
  commit('setBookList', data)
}
```

If the number of read books is large, the API call may take longer to respond
when fetching read books compared to when fetching unread books. Consequently,
if the user switches quickly between the two menus, the following actions will
be triggered:

```javascript
dispatch('loadBooks', 'read')
// and a few ms later
dispatch('loadBooks', 'unread')
```

But since the API call is slower for read books, the order of commits will be
reversed and the store will not reflect the user's latest action.

```javascript
commit('setBooksList', unreadBooksData)
// and a few ms later
commit('setBooksList', readBooksData)
```

In this case it would be interesting to be able to cancel `loadBooks, read` as
soon as `loadBooks, unread` is received to avoid the second commit. This is
exactly what this library provides.
