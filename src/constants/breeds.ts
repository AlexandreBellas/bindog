import type { IBreed } from "#/@types/game"

/**
 * Shared dog-breed catalog for Bindog boards and announcements.
 * Names are English for now; each breed has art under `/public/breeds`.
 */
export const BREEDS: readonly IBreed[] = [
    { id: "labrador-retriever", name: "Labrador Retriever", imageSrc: "/breeds/labrador-retriever.png" },
    { id: "german-shepherd", name: "German Shepherd", imageSrc: "/breeds/german-shepherd.png" },
    { id: "golden-retriever", name: "Golden Retriever", imageSrc: "/breeds/golden-retriever.png" },
    { id: "french-bulldog", name: "French Bulldog", imageSrc: "/breeds/french-bulldog.png" },
    { id: "bulldog", name: "Bulldog", imageSrc: "/breeds/bulldog.png" },
    { id: "poodle", name: "Poodle", imageSrc: "/breeds/poodle.png" },
    { id: "beagle", name: "Beagle", imageSrc: "/breeds/beagle.png" },
    { id: "rottweiler", name: "Rottweiler", imageSrc: "/breeds/rottweiler.png" },
    { id: "german-shorthaired-pointer", name: "German Shorthaired Pointer", imageSrc: "/breeds/german-shorthaired-pointer.png" },
    { id: "dachshund", name: "Dachshund", imageSrc: "/breeds/dachshund.png" },
    { id: "pembroke-welsh-corgi", name: "Pembroke Welsh Corgi", imageSrc: "/breeds/pembroke-welsh-corgi.png" },
    { id: "australian-shepherd", name: "Australian Shepherd", imageSrc: "/breeds/australian-shepherd.png" },
    { id: "yorkshire-terrier", name: "Yorkshire Terrier", imageSrc: "/breeds/yorkshire-terrier.png" },
    { id: "boxer", name: "Boxer", imageSrc: "/breeds/boxer.png" },
    { id: "cavalier-king-charles-spaniel", name: "Cavalier King Charles Spaniel", imageSrc: "/breeds/cavalier-king-charles-spaniel.png" },
    { id: "doberman-pinscher", name: "Doberman Pinscher", imageSrc: "/breeds/doberman-pinscher.png" },
    { id: "great-dane", name: "Great Dane", imageSrc: "/breeds/great-dane.png" },
    { id: "miniature-schnauzer", name: "Miniature Schnauzer", imageSrc: "/breeds/miniature-schnauzer.png" },
    { id: "siberian-husky", name: "Siberian Husky", imageSrc: "/breeds/siberian-husky.png" },
    { id: "bernese-mountain-dog", name: "Bernese Mountain Dog", imageSrc: "/breeds/bernese-mountain-dog.png" },
    { id: "cocker-spaniel", name: "Cocker Spaniel", imageSrc: "/breeds/cocker-spaniel.png" },
    { id: "border-collie", name: "Border Collie", imageSrc: "/breeds/border-collie.png" },
    { id: "shih-tzu", name: "Shih Tzu", imageSrc: "/breeds/shih-tzu.png" },
    { id: "boston-terrier", name: "Boston Terrier", imageSrc: "/breeds/boston-terrier.png" },
    { id: "pomeranian", name: "Pomeranian", imageSrc: "/breeds/pomeranian.png" },
    { id: "havanese", name: "Havanese", imageSrc: "/breeds/havanese.png" },
    { id: "shetland-sheepdog", name: "Shetland Sheepdog", imageSrc: "/breeds/shetland-sheepdog.png" },
    { id: "brittany", name: "Brittany", imageSrc: "/breeds/brittany.png" },
    { id: "pug", name: "Pug", imageSrc: "/breeds/pug.png" },
    { id: "english-springer-spaniel", name: "English Springer Spaniel", imageSrc: "/breeds/english-springer-spaniel.png" },
    { id: "chihuahua", name: "Chihuahua", imageSrc: "/breeds/chihuahua.png" },
    { id: "vizsla", name: "Vizsla", imageSrc: "/breeds/vizsla.png" },
    { id: "mastiff", name: "Mastiff", imageSrc: "/breeds/mastiff.png" },
    { id: "basset-hound", name: "Basset Hound", imageSrc: "/breeds/basset-hound.png" },
    { id: "maltese", name: "Maltese", imageSrc: "/breeds/maltese.png" },
    { id: "collie", name: "Collie", imageSrc: "/breeds/collie.png" },
    { id: "rhodesian-ridgeback", name: "Rhodesian Ridgeback", imageSrc: "/breeds/rhodesian-ridgeback.png" },
    { id: "newfoundland", name: "Newfoundland", imageSrc: "/breeds/newfoundland.png" },
    { id: "west-highland-white-terrier", name: "West Highland White Terrier", imageSrc: "/breeds/west-highland-white-terrier.png" },
    { id: "belgian-malinois", name: "Belgian Malinois", imageSrc: "/breeds/belgian-malinois.png" },
    { id: "whippet", name: "Whippet", imageSrc: "/breeds/whippet.png" },
    { id: "bichon-frise", name: "Bichon Frise", imageSrc: "/breeds/bichon-frise.png" },
    { id: "akita", name: "Akita", imageSrc: "/breeds/akita.png" },
    { id: "saint-bernard", name: "Saint Bernard", imageSrc: "/breeds/saint-bernard.png" },
    { id: "weimaraner", name: "Weimaraner", imageSrc: "/breeds/weimaraner.png" },
    { id: "soft-coated-wheaten-terrier", name: "Soft Coated Wheaten Terrier", imageSrc: "/breeds/soft-coated-wheaten-terrier.png" },
    { id: "bullmastiff", name: "Bullmastiff", imageSrc: "/breeds/bullmastiff.png" },
    { id: "scottish-terrier", name: "Scottish Terrier", imageSrc: "/breeds/scottish-terrier.png" },
    { id: "papillon", name: "Papillon", imageSrc: "/breeds/papillon.png" },
    { id: "australian-cattle-dog", name: "Australian Cattle Dog", imageSrc: "/breeds/australian-cattle-dog.png" },
    { id: "dalmatian", name: "Dalmatian", imageSrc: "/breeds/dalmatian.png" },
    { id: "alaskan-malamute", name: "Alaskan Malamute", imageSrc: "/breeds/alaskan-malamute.png" },
    { id: "chinese-shar-pei", name: "Chinese Shar-Pei", imageSrc: "/breeds/chinese-shar-pei.png" },
    { id: "airedale-terrier", name: "Airedale Terrier", imageSrc: "/breeds/airedale-terrier.png" },
    { id: "bloodhound", name: "Bloodhound", imageSrc: "/breeds/bloodhound.png" },
    { id: "samoyed", name: "Samoyed", imageSrc: "/breeds/samoyed.png" },
    { id: "irish-setter", name: "Irish Setter", imageSrc: "/breeds/irish-setter.png" },
    { id: "chow-chow", name: "Chow Chow", imageSrc: "/breeds/chow-chow.png" },
    { id: "greyhound", name: "Greyhound", imageSrc: "/breeds/greyhound.png" },
    { id: "shiba-inu", name: "Shiba Inu", imageSrc: "/breeds/shiba-inu.png" }
] as const

export const BREED_IDS: readonly string[] = BREEDS.map(breed => breed.id)

export const BREED_BY_ID: Readonly<Record<string, IBreed>> = Object.fromEntries(BREEDS.map(breed => [breed.id, breed]))

/** Center cell index on a 5×5 board (row-major). */
export const WILD_CELL_INDEX = 12
