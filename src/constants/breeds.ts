import type { IBreed } from "#/@types/game"

/**
 * Shared dog-breed catalog for Bindog boards and announcements.
 * Display names live in Paraglide messages (`breed_*`); each breed has art under `/public/breeds`.
 */
export const BREEDS: readonly IBreed[] = [
    { id: "labrador-retriever", imageSrc: "/breeds/labrador-retriever.png" },
    { id: "german-shepherd", imageSrc: "/breeds/german-shepherd.png" },
    { id: "golden-retriever", imageSrc: "/breeds/golden-retriever.png" },
    { id: "french-bulldog", imageSrc: "/breeds/french-bulldog.png" },
    { id: "bulldog", imageSrc: "/breeds/bulldog.png" },
    { id: "poodle", imageSrc: "/breeds/poodle.png" },
    { id: "beagle", imageSrc: "/breeds/beagle.png" },
    { id: "rottweiler", imageSrc: "/breeds/rottweiler.png" },
    { id: "german-shorthaired-pointer", imageSrc: "/breeds/german-shorthaired-pointer.png" },
    { id: "dachshund", imageSrc: "/breeds/dachshund.png" },
    { id: "pembroke-welsh-corgi", imageSrc: "/breeds/pembroke-welsh-corgi.png" },
    { id: "australian-shepherd", imageSrc: "/breeds/australian-shepherd.png" },
    { id: "yorkshire-terrier", imageSrc: "/breeds/yorkshire-terrier.png" },
    { id: "boxer", imageSrc: "/breeds/boxer.png" },
    { id: "cavalier-king-charles-spaniel", imageSrc: "/breeds/cavalier-king-charles-spaniel.png" },
    { id: "doberman-pinscher", imageSrc: "/breeds/doberman-pinscher.png" },
    { id: "great-dane", imageSrc: "/breeds/great-dane.png" },
    { id: "miniature-schnauzer", imageSrc: "/breeds/miniature-schnauzer.png" },
    { id: "siberian-husky", imageSrc: "/breeds/siberian-husky.png" },
    { id: "bernese-mountain-dog", imageSrc: "/breeds/bernese-mountain-dog.png" },
    { id: "cocker-spaniel", imageSrc: "/breeds/cocker-spaniel.png" },
    { id: "border-collie", imageSrc: "/breeds/border-collie.png" },
    { id: "shih-tzu", imageSrc: "/breeds/shih-tzu.png" },
    { id: "boston-terrier", imageSrc: "/breeds/boston-terrier.png" },
    { id: "pomeranian", imageSrc: "/breeds/pomeranian.png" },
    { id: "havanese", imageSrc: "/breeds/havanese.png" },
    { id: "shetland-sheepdog", imageSrc: "/breeds/shetland-sheepdog.png" },
    { id: "brittany", imageSrc: "/breeds/brittany.png" },
    { id: "pug", imageSrc: "/breeds/pug.png" },
    { id: "english-springer-spaniel", imageSrc: "/breeds/english-springer-spaniel.png" },
    { id: "chihuahua", imageSrc: "/breeds/chihuahua.png" },
    { id: "vizsla", imageSrc: "/breeds/vizsla.png" },
    { id: "mastiff", imageSrc: "/breeds/mastiff.png" },
    { id: "basset-hound", imageSrc: "/breeds/basset-hound.png" },
    { id: "maltese", imageSrc: "/breeds/maltese.png" },
    { id: "collie", imageSrc: "/breeds/collie.png" },
    { id: "rhodesian-ridgeback", imageSrc: "/breeds/rhodesian-ridgeback.png" },
    { id: "newfoundland", imageSrc: "/breeds/newfoundland.png" },
    { id: "west-highland-white-terrier", imageSrc: "/breeds/west-highland-white-terrier.png" },
    { id: "belgian-malinois", imageSrc: "/breeds/belgian-malinois.png" },
    { id: "whippet", imageSrc: "/breeds/whippet.png" },
    { id: "bichon-frise", imageSrc: "/breeds/bichon-frise.png" },
    { id: "akita", imageSrc: "/breeds/akita.png" },
    { id: "saint-bernard", imageSrc: "/breeds/saint-bernard.png" },
    { id: "weimaraner", imageSrc: "/breeds/weimaraner.png" },
    { id: "soft-coated-wheaten-terrier", imageSrc: "/breeds/soft-coated-wheaten-terrier.png" },
    { id: "bullmastiff", imageSrc: "/breeds/bullmastiff.png" },
    { id: "scottish-terrier", imageSrc: "/breeds/scottish-terrier.png" },
    { id: "papillon", imageSrc: "/breeds/papillon.png" },
    { id: "australian-cattle-dog", imageSrc: "/breeds/australian-cattle-dog.png" },
    { id: "dalmatian", imageSrc: "/breeds/dalmatian.png" },
    { id: "alaskan-malamute", imageSrc: "/breeds/alaskan-malamute.png" },
    { id: "chinese-shar-pei", imageSrc: "/breeds/chinese-shar-pei.png" },
    { id: "airedale-terrier", imageSrc: "/breeds/airedale-terrier.png" },
    { id: "bloodhound", imageSrc: "/breeds/bloodhound.png" },
    { id: "samoyed", imageSrc: "/breeds/samoyed.png" },
    { id: "irish-setter", imageSrc: "/breeds/irish-setter.png" },
    { id: "chow-chow", imageSrc: "/breeds/chow-chow.png" },
    { id: "greyhound", imageSrc: "/breeds/greyhound.png" },
    { id: "shiba-inu", imageSrc: "/breeds/shiba-inu.png" },
    { id: "vira-lata-caramelo", imageSrc: "/breeds/vira-lata-caramelo.png" },
    { id: "vira-lata-fiapo-de-manga", imageSrc: "/breeds/vira-lata-fiapo-de-manga.png" },
    { id: "vira-lata-bolo-formigueiro", imageSrc: "/breeds/vira-lata-bolo-formigueiro.png" },
    { id: "vira-lata-meio-poodle", imageSrc: "/breeds/vira-lata-meio-poodle.png" },
    { id: "vira-lata-raposinha", imageSrc: "/breeds/vira-lata-raposinha.png" }
] as const

export const BREED_IDS: readonly string[] = BREEDS.map(breed => breed.id)

export const BREED_BY_ID: Readonly<Record<string, IBreed>> = Object.fromEntries(BREEDS.map(breed => [breed.id, breed]))

/** Center cell index on a 5×5 board (row-major). */
export const WILD_CELL_INDEX = 12
