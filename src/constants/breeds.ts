import type { IBreed } from "#/@types/game"

const PLACEHOLDER = "/breeds/placeholder.svg"

/**
 * Shared dog-breed catalog for Bindog boards and announcements.
 * Names are English for now; art is a shared placeholder until breed assets exist.
 */
export const BREEDS: readonly IBreed[] = [
    { id: "labrador-retriever", name: "Labrador Retriever", imageSrc: PLACEHOLDER },
    { id: "german-shepherd", name: "German Shepherd", imageSrc: PLACEHOLDER },
    { id: "golden-retriever", name: "Golden Retriever", imageSrc: PLACEHOLDER },
    { id: "french-bulldog", name: "French Bulldog", imageSrc: PLACEHOLDER },
    { id: "bulldog", name: "Bulldog", imageSrc: PLACEHOLDER },
    { id: "poodle", name: "Poodle", imageSrc: PLACEHOLDER },
    { id: "beagle", name: "Beagle", imageSrc: PLACEHOLDER },
    { id: "rottweiler", name: "Rottweiler", imageSrc: PLACEHOLDER },
    { id: "german-shorthaired-pointer", name: "German Shorthaired Pointer", imageSrc: PLACEHOLDER },
    { id: "dachshund", name: "Dachshund", imageSrc: PLACEHOLDER },
    { id: "pembroke-welsh-corgi", name: "Pembroke Welsh Corgi", imageSrc: PLACEHOLDER },
    { id: "australian-shepherd", name: "Australian Shepherd", imageSrc: PLACEHOLDER },
    { id: "yorkshire-terrier", name: "Yorkshire Terrier", imageSrc: PLACEHOLDER },
    { id: "boxer", name: "Boxer", imageSrc: PLACEHOLDER },
    { id: "cavalier-king-charles-spaniel", name: "Cavalier King Charles Spaniel", imageSrc: PLACEHOLDER },
    { id: "doberman-pinscher", name: "Doberman Pinscher", imageSrc: PLACEHOLDER },
    { id: "great-dane", name: "Great Dane", imageSrc: PLACEHOLDER },
    { id: "miniature-schnauzer", name: "Miniature Schnauzer", imageSrc: PLACEHOLDER },
    { id: "siberian-husky", name: "Siberian Husky", imageSrc: PLACEHOLDER },
    { id: "bernese-mountain-dog", name: "Bernese Mountain Dog", imageSrc: PLACEHOLDER },
    { id: "cocker-spaniel", name: "Cocker Spaniel", imageSrc: PLACEHOLDER },
    { id: "border-collie", name: "Border Collie", imageSrc: PLACEHOLDER },
    { id: "shih-tzu", name: "Shih Tzu", imageSrc: PLACEHOLDER },
    { id: "boston-terrier", name: "Boston Terrier", imageSrc: PLACEHOLDER },
    { id: "pomeranian", name: "Pomeranian", imageSrc: PLACEHOLDER },
    { id: "havanese", name: "Havanese", imageSrc: PLACEHOLDER },
    { id: "shetland-sheepdog", name: "Shetland Sheepdog", imageSrc: PLACEHOLDER },
    { id: "brittany", name: "Brittany", imageSrc: PLACEHOLDER },
    { id: "pug", name: "Pug", imageSrc: PLACEHOLDER },
    { id: "english-springer-spaniel", name: "English Springer Spaniel", imageSrc: PLACEHOLDER },
    { id: "chihuahua", name: "Chihuahua", imageSrc: PLACEHOLDER },
    { id: "vizsla", name: "Vizsla", imageSrc: PLACEHOLDER },
    { id: "mastiff", name: "Mastiff", imageSrc: PLACEHOLDER },
    { id: "basset-hound", name: "Basset Hound", imageSrc: PLACEHOLDER },
    { id: "maltese", name: "Maltese", imageSrc: PLACEHOLDER },
    { id: "collie", name: "Collie", imageSrc: PLACEHOLDER },
    { id: "rhodesian-ridgeback", name: "Rhodesian Ridgeback", imageSrc: PLACEHOLDER },
    { id: "newfoundland", name: "Newfoundland", imageSrc: PLACEHOLDER },
    { id: "west-highland-white-terrier", name: "West Highland White Terrier", imageSrc: PLACEHOLDER },
    { id: "belgian-malinois", name: "Belgian Malinois", imageSrc: PLACEHOLDER },
    { id: "whippet", name: "Whippet", imageSrc: PLACEHOLDER },
    { id: "bichon-frise", name: "Bichon Frise", imageSrc: PLACEHOLDER },
    { id: "akita", name: "Akita", imageSrc: PLACEHOLDER },
    { id: "saint-bernard", name: "Saint Bernard", imageSrc: PLACEHOLDER },
    { id: "weimaraner", name: "Weimaraner", imageSrc: PLACEHOLDER },
    { id: "soft-coated-wheaten-terrier", name: "Soft Coated Wheaten Terrier", imageSrc: PLACEHOLDER },
    { id: "bullmastiff", name: "Bullmastiff", imageSrc: PLACEHOLDER },
    { id: "scottish-terrier", name: "Scottish Terrier", imageSrc: PLACEHOLDER },
    { id: "papillon", name: "Papillon", imageSrc: PLACEHOLDER },
    { id: "australian-cattle-dog", name: "Australian Cattle Dog", imageSrc: PLACEHOLDER },
    { id: "dalmatian", name: "Dalmatian", imageSrc: PLACEHOLDER },
    { id: "alaskan-malamute", name: "Alaskan Malamute", imageSrc: PLACEHOLDER },
    { id: "chinese-shar-pei", name: "Chinese Shar-Pei", imageSrc: PLACEHOLDER },
    { id: "airedale-terrier", name: "Airedale Terrier", imageSrc: PLACEHOLDER },
    { id: "bloodhound", name: "Bloodhound", imageSrc: PLACEHOLDER },
    { id: "samoyed", name: "Samoyed", imageSrc: PLACEHOLDER },
    { id: "irish-setter", name: "Irish Setter", imageSrc: PLACEHOLDER },
    { id: "chow-chow", name: "Chow Chow", imageSrc: PLACEHOLDER },
    { id: "greyhound", name: "Greyhound", imageSrc: PLACEHOLDER },
    { id: "shiba-inu", name: "Shiba Inu", imageSrc: PLACEHOLDER }
] as const

export const BREED_IDS: readonly string[] = BREEDS.map(breed => breed.id)

export const BREED_BY_ID: Readonly<Record<string, IBreed>> = Object.fromEntries(BREEDS.map(breed => [breed.id, breed]))

/** Center cell index on a 5×5 board (row-major). */
export const WILD_CELL_INDEX = 12
