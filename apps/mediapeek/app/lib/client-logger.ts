"use client"

import { initLog, log } from "evlog/client"

initLog({ service: "mediapeek" })

export const clientLog = log
