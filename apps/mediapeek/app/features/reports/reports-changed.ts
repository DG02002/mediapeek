const REPORTS_CHANGED_EVENT = "mediapeek:reports-changed"

export const notifyReportsChanged = () => {
  window.dispatchEvent(new Event(REPORTS_CHANGED_EVENT))
}

export const subscribeToReportsChanged = (callback: () => void) => {
  window.addEventListener(REPORTS_CHANGED_EVENT, callback)

  return () => {
    window.removeEventListener(REPORTS_CHANGED_EVENT, callback)
  }
}
