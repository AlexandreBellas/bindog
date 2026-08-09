import { beforeEach } from "vitest"
import { ensureLocalStorage } from "./mocks/localStorage"
import { mockMatchMedia } from "./mocks/matchMedia"

beforeEach(() => {
    ensureLocalStorage()
    mockMatchMedia()
})
