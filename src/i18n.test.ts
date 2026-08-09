import { BASE_LOCALE, locales } from "#/utils/constants/locales"
import type { INestedRecord } from "#/utils/types/nested-record"
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const MESSAGES_DIR = path.resolve(process.cwd(), "messages")

const expectTranslationsRecursively = (props: {
    englishLocale: INestedRecord<string>
    currLocale: INestedRecord<string>
    language: string
    path?: string
}) => {
    const { englishLocale, currLocale, language, path: keyPath } = props

    for (const key of Object.keys(englishLocale)) {
        const englishLocaleEntry = englishLocale[key]
        const currLocaleEntry = currLocale[key]
        const fullPath = keyPath ? `${keyPath}.${key}` : key

        expect(currLocaleEntry, `Missing entry "${fullPath}" for locale "${language}"`).toBeDefined()

        if (typeof englishLocaleEntry === "object" && englishLocaleEntry !== null) {
            expect(currLocaleEntry, `Entry "${fullPath}" for locale "${language}" must be an object`).toBeTypeOf(
                "object"
            )

            expectTranslationsRecursively({
                englishLocale: englishLocaleEntry,
                currLocale: currLocaleEntry as INestedRecord<string>,
                language,
                path: fullPath
            })
            continue
        }

        expect(currLocaleEntry, `Entry "${fullPath}" for locale "${language}" must be a string`).toBeTypeOf("string")
        expect(
            (currLocaleEntry as string).length,
            `Entry "${fullPath}" for locale "${language}" must be non-empty`
        ).toBeGreaterThan(0)
    }
}

const readLocaleFile = (language: string): INestedRecord<string> => {
    const filePath = path.join(MESSAGES_DIR, `${language}.json`)
    const content = fs.readFileSync(filePath, "utf8")
    return JSON.parse(content) as INestedRecord<string>
}

describe("i18n", () => {
    describe("base", () => {
        it(`should have a non-empty ${BASE_LOCALE} translation file`, () => {
            const englishLocale = readLocaleFile(BASE_LOCALE)

            expect(englishLocale).toBeTypeOf("object")
            expect(englishLocale).not.toBeNull()
            expect(Object.keys(englishLocale).length, `File for locale "${BASE_LOCALE}" is empty`).toBeGreaterThan(0)
        })
    })

    describe.each([...locales])('locale "%s"', language => {
        describe("files", () => {
            it("should exist dedicated messages file", () => {
                const filePath = path.join(MESSAGES_DIR, `${language}.json`)
                expect(fs.existsSync(filePath)).toBe(true)
            })
        })

        describe("translations", () => {
            it("should have all translations matching the base locale keys", () => {
                const englishLocale = readLocaleFile(BASE_LOCALE)
                const currLocale = readLocaleFile(language)

                expect(currLocale).toBeTypeOf("object")
                expect(currLocale).not.toBeNull()
                expect(Object.keys(currLocale).length, `File for locale "${language}" is empty`).toBeGreaterThan(0)

                expectTranslationsRecursively({ englishLocale, currLocale, language })
            })

            it("should not contain extra keys beyond the base locale", () => {
                const englishLocale = readLocaleFile(BASE_LOCALE)
                const currLocale = readLocaleFile(language)

                for (const key of Object.keys(currLocale)) {
                    expect(englishLocale[key], `Unexpected extra key "${key}" in locale "${language}"`).toBeDefined()
                }
            })
        })
    })
})
