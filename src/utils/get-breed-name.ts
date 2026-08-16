import { m } from "#/paraglide/messages"

type IBreedNameMessage = () => string

/**
 * Maps catalog breed ids to their Paraglide message getters (`breed_*`).
 */
const BREED_NAME_BY_ID: Readonly<Record<string, IBreedNameMessage>> = {
    "labrador-retriever": m.breed_labrador_retriever,
    "german-shepherd": m.breed_german_shepherd,
    "golden-retriever": m.breed_golden_retriever,
    "french-bulldog": m.breed_french_bulldog,
    bulldog: m.breed_bulldog,
    poodle: m.breed_poodle,
    beagle: m.breed_beagle,
    rottweiler: m.breed_rottweiler,
    "german-shorthaired-pointer": m.breed_german_shorthaired_pointer,
    dachshund: m.breed_dachshund,
    "pembroke-welsh-corgi": m.breed_pembroke_welsh_corgi,
    "australian-shepherd": m.breed_australian_shepherd,
    "yorkshire-terrier": m.breed_yorkshire_terrier,
    boxer: m.breed_boxer,
    "cavalier-king-charles-spaniel": m.breed_cavalier_king_charles_spaniel,
    "doberman-pinscher": m.breed_doberman_pinscher,
    "great-dane": m.breed_great_dane,
    "miniature-schnauzer": m.breed_miniature_schnauzer,
    "siberian-husky": m.breed_siberian_husky,
    "bernese-mountain-dog": m.breed_bernese_mountain_dog,
    "cocker-spaniel": m.breed_cocker_spaniel,
    "border-collie": m.breed_border_collie,
    "shih-tzu": m.breed_shih_tzu,
    "boston-terrier": m.breed_boston_terrier,
    pomeranian: m.breed_pomeranian,
    havanese: m.breed_havanese,
    "shetland-sheepdog": m.breed_shetland_sheepdog,
    brittany: m.breed_brittany,
    pug: m.breed_pug,
    "english-springer-spaniel": m.breed_english_springer_spaniel,
    chihuahua: m.breed_chihuahua,
    vizsla: m.breed_vizsla,
    mastiff: m.breed_mastiff,
    "basset-hound": m.breed_basset_hound,
    maltese: m.breed_maltese,
    collie: m.breed_collie,
    "rhodesian-ridgeback": m.breed_rhodesian_ridgeback,
    newfoundland: m.breed_newfoundland,
    "west-highland-white-terrier": m.breed_west_highland_white_terrier,
    "belgian-malinois": m.breed_belgian_malinois,
    whippet: m.breed_whippet,
    "bichon-frise": m.breed_bichon_frise,
    akita: m.breed_akita,
    "saint-bernard": m.breed_saint_bernard,
    weimaraner: m.breed_weimaraner,
    "soft-coated-wheaten-terrier": m.breed_soft_coated_wheaten_terrier,
    bullmastiff: m.breed_bullmastiff,
    "scottish-terrier": m.breed_scottish_terrier,
    papillon: m.breed_papillon,
    "australian-cattle-dog": m.breed_australian_cattle_dog,
    dalmatian: m.breed_dalmatian,
    "alaskan-malamute": m.breed_alaskan_malamute,
    "chinese-shar-pei": m.breed_chinese_shar_pei,
    "airedale-terrier": m.breed_airedale_terrier,
    bloodhound: m.breed_bloodhound,
    samoyed: m.breed_samoyed,
    "irish-setter": m.breed_irish_setter,
    "chow-chow": m.breed_chow_chow,
    greyhound: m.breed_greyhound,
    "shiba-inu": m.breed_shiba_inu,
    "vira-lata-caramelo": m.breed_vira_lata_caramelo,
    "vira-lata-fiapo-de-manga": m.breed_vira_lata_fiapo_de_manga,
    "vira-lata-bolo-formigueiro": m.breed_vira_lata_bolo_formigueiro,
    "vira-lata-meio-poodle": m.breed_vira_lata_meio_poodle,
    "vira-lata-raposinha": m.breed_vira_lata_raposinha
}

/**
 * Returns the localized display name for a breed catalog id.
 */
export function getBreedName(breedId: string): string {
    return BREED_NAME_BY_ID[breedId]() || breedId
}
