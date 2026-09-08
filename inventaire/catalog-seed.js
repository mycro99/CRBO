// Catalogue historique de référence. Aucune quantité ni péremption n'est initialisée depuis ce fichier.
// Les modifications faites dans l'application priment sur ces valeurs, sans migration au chargement.
export const SEED_CATEGORIES = [
  {
    "id": "consommables",
    "name": "Consommables"
  },
  {
    "id": "desinfection",
    "name": "Désinfection"
  },
  {
    "id": "divers",
    "name": "Divers"
  },
  {
    "id": "DMP",
    "name": "DMP"
  },
  {
    "id": "entretien",
    "name": "Entretien"
  },
  {
    "id": "garage",
    "name": "Garage"
  },
  {
    "id": "vetements",
    "name": "Vêtements"
  }
];
export const SEED_ARTICLES = [
  {
    "id": "consommables-1",
    "name": "Accu‑check",
    "category": "consommables",
    "barcodes": [
      "4015630006038"
    ],
    "image": "images/Accu-check.jpg",
    "minStock": 2,
    "order": 0
  },
  {
    "id": "consommables-2",
    "name": "Aesculap",
    "category": "consommables",
    "barcodes": [
      "3661040010083",
      "9000010000010"
    ],
    "image": "images/aesculap.jpg",
    "minStock": 2,
    "order": 1
  },
  {
    "id": "consommables-3",
    "name": "Aspivenin",
    "category": "consommables",
    "barcodes": [
      "8717484000540"
    ],
    "image": "images/aspivenin.jpg",
    "minStock": 1,
    "order": 2
  },
  {
    "id": "consommables-4",
    "name": "Ballon réa adulte",
    "category": "consommables",
    "barcodes": [
      "845111"
    ],
    "image": "images/rea_adulte.jpg",
    "minStock": 10,
    "order": 3
  },
  {
    "id": "consommables-5",
    "name": "Ballon réa NN",
    "category": "consommables",
    "barcodes": [
      "845131"
    ],
    "image": "images/rea_NN.jpg",
    "minStock": 3,
    "order": 4
  },
  {
    "id": "consommables-6",
    "name": "Ballon réa pédia",
    "category": "consommables",
    "barcodes": [
      "845121"
    ],
    "image": "images/rea_pedia.jpg",
    "minStock": 3,
    "order": 5
  },
  {
    "id": "consommables-7",
    "name": "Bandage israélien",
    "category": "consommables",
    "barcodes": [
      "7290011042035",
      "7290011042066",
      "762470995353"
    ],
    "image": "images/band_isra.jpg",
    "minStock": 2,
    "order": 6
  },
  {
    "id": "consommables-8",
    "name": "Bandage triangle non stérile",
    "category": "consommables",
    "barcodes": [
      "4031815901417"
    ],
    "image": "images/band_triangle.jpg",
    "minStock": 20,
    "order": 7
  },
  {
    "id": "consommables-8b",
    "name": "Bandage triangle stérile",
    "category": "consommables",
    "barcodes": [
      "4031815901417"
    ],
    "image": "images/band_triangle1.jpg",
    "minStock": 20,
    "order": 8
  },
  {
    "id": "consommables-9",
    "name": "Bande velpeau 15cm",
    "category": "consommables",
    "barcodes": [
      "4049500987387",
      "8430655000353"
    ],
    "image": "images/velpo15.jpg",
    "minStock": 20,
    "order": 9
  },
  {
    "id": "consommables-10",
    "name": "Bande velpeau 10cm",
    "category": "consommables",
    "barcodes": [
      "4049500974745"
    ],
    "image": "images/velpo10.jpg",
    "minStock": 20,
    "order": 10
  },
  {
    "id": "consommables-11",
    "name": "Bande velpeau 7cm",
    "category": "consommables",
    "barcodes": [
      "4049500974738"
    ],
    "image": "images/velpo7.jpg",
    "minStock": 20,
    "order": 11
  },
  {
    "id": "consommables-12",
    "name": "Bande velpeau 5cm",
    "category": "consommables",
    "barcodes": [
      "4049500257800",
      "8430655000339",
      "134010717531731330633"
    ],
    "image": "images/velpo5.jpg",
    "minStock": 20,
    "order": 12
  },
  {
    "id": "consommables-13",
    "name": "Bassin réniforme",
    "category": "consommables",
    "barcodes": [
      "9000010000003"
    ],
    "image": "images/BR.jpg",
    "minStock": 50,
    "order": 13
  },
  {
    "id": "consommables-14",
    "name": "Batterie aspi",
    "category": "consommables",
    "barcodes": [
      "780800"
    ],
    "image": "images/bataspi.jpg",
    "minStock": 2,
    "order": 14
  },
  {
    "id": "consommables-15",
    "name": "Batterie DEA phillips",
    "category": "consommables",
    "barcodes": [
      "850633000003"
    ],
    "image": "images/bat_DEA.jpg",
    "minStock": 1,
    "order": 15
  },
  {
    "id": "consommables-16",
    "name": "Brosse à ongles",
    "category": "consommables",
    "barcodes": [
      "5410708009123"
    ],
    "image": "images/brosse_ongle.jpg",
    "minStock": 2,
    "order": 16
  },
  {
    "id": "consommables-17",
    "name": "Canule N°1 (blanche)",
    "category": "consommables",
    "barcodes": [
      "107701668"
    ],
    "image": "images/canule1.jpg",
    "minStock": 5,
    "order": 17
  },
  {
    "id": "consommables-18",
    "name": "Canule N°2 (verte)",
    "category": "consommables",
    "barcodes": [
      "107701651"
    ],
    "image": "images/canule2.jpg",
    "minStock": 5,
    "order": 18
  },
  {
    "id": "consommables-19",
    "name": "Canule N°3 (jaune)",
    "category": "consommables",
    "barcodes": [
      "107701645"
    ],
    "image": "images/canule3.jpg",
    "minStock": 5,
    "order": 19
  },
  {
    "id": "consommables-20",
    "name": "Canule N°4 (rouge)",
    "category": "consommables",
    "barcodes": [
      "107701639"
    ],
    "image": "images/canule4.jpg",
    "minStock": 5,
    "order": 20
  },
  {
    "id": "consommables-21",
    "name": "Canule N°5 (bleu)",
    "category": "consommables",
    "barcodes": [
      "107701622"
    ],
    "image": "images/canule5.jpg",
    "minStock": 5,
    "order": 21
  },
  {
    "id": "consommables-22",
    "name": "Canule N°6 (orange)",
    "category": "consommables",
    "barcodes": [
      "107701616"
    ],
    "image": "images/canule6.jpg",
    "minStock": 5,
    "order": 22
  },
  {
    "id": "consommables-23",
    "name": "Canule N°7 (noir)",
    "category": "consommables",
    "barcodes": [
      "107701674"
    ],
    "image": "images/canule7.jpg",
    "minStock": 5,
    "order": 23
  },
  {
    "id": "consommables-24",
    "name": "Canule pédia N°00 (bleu)",
    "category": "consommables",
    "barcodes": [
      "107701680"
    ],
    "image": "images/canule00.jpg",
    "minStock": 5,
    "order": 24
  },
  {
    "id": "consommables-25",
    "name": "Canule pédia N°000 (rose)",
    "category": "consommables",
    "barcodes": [
      "107701697"
    ],
    "image": "images/canule000.jpg",
    "minStock": 5,
    "order": 25
  },
  {
    "id": "consommables-26",
    "name": "Champ stérile",
    "category": "consommables",
    "barcodes": [
      "4031815711320",
      "4031815710521",
      "4031815710811"
    ],
    "image": "images/champ_sterile.jpg",
    "minStock": 10,
    "order": 26
  },
  {
    "id": "consommables-27",
    "name": "chlorhexidine",
    "category": "consommables",
    "barcodes": [
      "1726110010015"
    ],
    "image": "images/chlorhexidine.jpg",
    "minStock": 2,
    "order": 27
  },
  {
    "id": "consommables-28",
    "name": "Coffee creamer",
    "category": "consommables",
    "barcodes": [
      "5411651260043"
    ],
    "image": "images/coffee_creamer.jpg",
    "minStock": 1,
    "order": 28
  },
  {
    "id": "consommables-29",
    "name": "Cold pack",
    "category": "consommables",
    "barcodes": [
      "9000010000001"
    ],
    "image": "images/cold_pack.jpg",
    "minStock": 15,
    "order": 29
  },
  {
    "id": "consommables-30",
    "name": "Collier cervical adulte",
    "category": "consommables",
    "barcodes": [
      "10107045432105575100922"
    ],
    "image": "images/collier_adulte.jpg",
    "minStock": 5,
    "order": 30
  },
  {
    "id": "consommables-31",
    "name": "Collier cervical pédia",
    "category": "consommables",
    "barcodes": [
      "9000010000004"
    ],
    "image": "images/collier_pedia.jpg",
    "minStock": 3,
    "order": 31
  },
  {
    "id": "consommables-32",
    "name": "Compresses 10x20",
    "category": "consommables",
    "barcodes": [
      "4049500658911"
    ],
    "image": "images/compresses_10x20.jpg",
    "minStock": 2,
    "order": 32
  },
  {
    "id": "consommables-33",
    "name": "Compresses 10x10",
    "category": "consommables",
    "barcodes": [
      "4049500727181",
      "4052199606699"
    ],
    "image": "images/compresses_10x10.jpg",
    "minStock": 2,
    "order": 33
  },
  {
    "id": "consommables-34",
    "name": "Compresses 7.5x7.5",
    "category": "consommables",
    "barcodes": [
      "4052199606637"
    ],
    "image": "images/compresses_7.5x7.5.jpg",
    "minStock": 2,
    "order": 34
  },
  {
    "id": "consommables-35",
    "name": "Compresses 5x5",
    "category": "consommables",
    "barcodes": [
      "4049500727037"
    ],
    "image": "images/compresses_5x5.jpg",
    "minStock": 4,
    "order": 35
  },
  {
    "id": "consommables-36",
    "name": "Conteneur B2 ambu",
    "category": "consommables",
    "barcodes": [
      "0105060107836228"
    ],
    "image": "images/B2_ambu.jpg",
    "minStock": 2,
    "order": 36
  },
  {
    "id": "consommables-37",
    "name": "Conteneur B2 de poche",
    "category": "consommables",
    "barcodes": [
      "0105056271508283",
      "0105056271508221"
    ],
    "image": "images/B2_poche.jpg",
    "minStock": 2,
    "order": 37
  },
  {
    "id": "consommables-38",
    "name": "Coussin stolenwerk noir",
    "category": "consommables",
    "barcodes": [],
    "image": "images/coussin_noir.jpg",
    "minStock": 1,
    "order": 38
  },
  {
    "id": "consommables-39",
    "name": "Coussin stolenwerk orange",
    "category": "consommables",
    "barcodes": [],
    "image": "images/Coussin_orange.jpg",
    "minStock": 1,
    "order": 39
  },
  {
    "id": "consommables-40",
    "name": "Couverture de survie",
    "category": "consommables",
    "barcodes": [
      "4044941040707",
      "4031815901615"
    ],
    "image": "images/couverture_survie.jpg",
    "minStock": 30,
    "order": 40
  },
  {
    "id": "consommables-41",
    "name": "crevette",
    "category": "consommables",
    "barcodes": [
      "9000010000006"
    ],
    "image": "images/crevette.jpg",
    "minStock": 20,
    "order": 41
  },
  {
    "id": "consommables-42",
    "name": "embout thermometre",
    "category": "consommables",
    "barcodes": [
      "00732094314618",
      "10100732094314618"
    ],
    "image": "images/embout_thermo.jpg",
    "minStock": 10,
    "order": 42
  },
  {
    "id": "consommables-43",
    "name": "essui accouchement",
    "category": "consommables",
    "barcodes": [],
    "image": "images/essui_accouchement.jpg",
    "minStock": 4,
    "order": 43
  },
  {
    "id": "consommables-44",
    "name": "filtre réa",
    "category": "consommables",
    "barcodes": [
      "0104026704348008172703281122042210220722"
    ],
    "image": "images/filtre_rea.jpg",
    "minStock": 20,
    "order": 44
  },
  {
    "id": "consommables-45",
    "name": "garrot tourniquet",
    "category": "consommables",
    "barcodes": [
      "01008220450002161020230508"
    ],
    "image": "images/garrot.jpg",
    "minStock": 5,
    "order": 45
  },
  {
    "id": "consommables-46",
    "name": "gluco",
    "category": "consommables",
    "barcodes": [
      "5021791709151"
    ],
    "image": "images/gluco.jpg",
    "minStock": 1,
    "order": 46
  },
  {
    "id": "consommables-47",
    "name": "Gants L",
    "category": "consommables",
    "barcodes": [
      "4052199309132"
    ],
    "image": "images/gantsL.jpg",
    "minStock": 10,
    "order": 47
  },
  {
    "id": "consommables-48",
    "name": "gants M",
    "category": "consommables",
    "barcodes": [
      "4052199308906"
    ],
    "image": "images/gantsM.jpg",
    "minStock": 20,
    "order": 48
  },
  {
    "id": "consommables-49",
    "name": "gants S",
    "category": "consommables",
    "barcodes": [
      "4052199308852"
    ],
    "image": "images/gantsS.jpg",
    "minStock": 5,
    "order": 49
  },
  {
    "id": "consommables-50",
    "name": "gants XL",
    "category": "consommables",
    "barcodes": [
      "4052199309163"
    ],
    "image": "images/gantsXL.jpg",
    "minStock": 10,
    "order": 50
  },
  {
    "id": "consommables-51",
    "name": "iso‑bétadine",
    "category": "consommables",
    "barcodes": [
      "2247849"
    ],
    "image": "images/iso.jpg",
    "minStock": 2,
    "order": 51
  },
  {
    "id": "consommables-52",
    "name": "kit accouchement",
    "category": "consommables",
    "barcodes": [],
    "image": "images/kit_accouchement.jpg",
    "minStock": 3,
    "order": 52
  },
  {
    "id": "consommables-53",
    "name": "kit injection",
    "category": "consommables",
    "barcodes": [],
    "image": "images/kit_injection.jpg",
    "minStock": 5,
    "order": 53
  },
  {
    "id": "consommables-54",
    "name": "kit mousse speedblock",
    "category": "consommables",
    "barcodes": [],
    "image": "images/mousse_speedblock.jpg",
    "minStock": 5,
    "order": 54
  },
  {
    "id": "consommables-55",
    "name": "kit VP",
    "category": "consommables",
    "barcodes": [],
    "image": "images/kit_VP.jpg",
    "minStock": 5,
    "order": 55
  },
  {
    "id": "consommables-56",
    "name": "lampe pupille",
    "category": "consommables",
    "barcodes": [
      "4044941040028"
    ],
    "image": "images/lampe_pupille.jpg",
    "minStock": 2,
    "order": 56
  },
  {
    "id": "consommables-57",
    "name": "lange adulte",
    "category": "consommables",
    "barcodes": [
      "3401046569679"
    ],
    "image": "images/lange.jpg",
    "minStock": 2,
    "order": 57
  },
  {
    "id": "consommables-58",
    "name": "flapule LP",
    "category": "consommables",
    "barcodes": [
      "4030539076227",
      "2409365",
      "5400519001171"
    ],
    "image": "images/flapule_LP.jpg",
    "minStock": 3,
    "order": 58
  },
  {
    "id": "consommables-59",
    "name": "lunettes O² adulte",
    "category": "consommables",
    "barcodes": [
      "103799328"
    ],
    "image": "images/lunettes_O2_adulte.jpg",
    "minStock": 10,
    "order": 59
  },
  {
    "id": "consommables-60",
    "name": "lunettes O² pédia",
    "category": "consommables",
    "barcodes": [
      "103799305"
    ],
    "image": "images/lunettes_O2_pedia.jpg",
    "minStock": 10,
    "order": 60
  },
  {
    "id": "consommables-61",
    "name": "macaron jaune",
    "category": "consommables",
    "barcodes": [],
    "image": "images/macaron_jaune.jpg",
    "minStock": 10,
    "order": 61
  },
  {
    "id": "consommables-62",
    "name": "macaron noir",
    "category": "consommables",
    "barcodes": [],
    "image": "images/macaron_noir.jpg",
    "minStock": 10,
    "order": 62
  },
  {
    "id": "consommables-63",
    "name": "macaron rouge",
    "category": "consommables",
    "barcodes": [],
    "image": "images/macaron_rouge.jpg",
    "minStock": 10,
    "order": 63
  },
  {
    "id": "consommables-64",
    "name": "masque 100% adulte",
    "category": "consommables",
    "barcodes": [
      "103072193"
    ],
    "image": "images/100_adulte.jpg",
    "minStock": 10,
    "order": 64
  },
  {
    "id": "consommables-65",
    "name": "Masque 100% pédia",
    "category": "consommables",
    "barcodes": [
      "103498489"
    ],
    "image": "images/100_pedia.jpg",
    "minStock": 10,
    "order": 65
  },
  {
    "id": "consommables-66",
    "name": "masque aerosol adulte",
    "category": "consommables",
    "barcodes": [
      "10104034342261177"
    ],
    "image": "images/aerosol_adulte.jpg",
    "minStock": 5,
    "order": 66
  },
  {
    "id": "consommables-67",
    "name": "masque aérosol pédia",
    "category": "consommables",
    "barcodes": [
      "10104034342261153"
    ],
    "image": "images/aerosol_pedia.jpg",
    "minStock": 5,
    "order": 67
  },
  {
    "id": "consommables-68",
    "name": "masque chir",
    "category": "consommables",
    "barcodes": [
      "9000010000007"
    ],
    "image": "images/chir.jpg",
    "minStock": 20,
    "order": 68
  },
  {
    "id": "consommables-69",
    "name": "masque ffp2",
    "category": "consommables",
    "barcodes": [
      "6973081843337"
    ],
    "image": "images/ffp2.jpg",
    "minStock": 20,
    "order": 69
  },
  {
    "id": "consommables-70",
    "name": "mouchoirs",
    "category": "consommables",
    "barcodes": [],
    "image": "images/mouchoirs.jpg",
    "minStock": 5,
    "order": 70
  },
  {
    "id": "consommables-71",
    "name": "omnifix",
    "category": "consommables",
    "barcodes": [
      "4049500967785",
      "4049500967754"
    ],
    "image": "images/omnifix.jpg",
    "minStock": 1,
    "order": 71
  },
  {
    "id": "consommables-72",
    "name": "Padding",
    "category": "consommables",
    "barcodes": [],
    "image": "images/padding.jpg",
    "minStock": 3,
    "order": 72
  },
  {
    "id": "consommables-73",
    "name": "pansement compressif",
    "category": "consommables",
    "barcodes": [
      "9000010000002"
    ],
    "image": "images/compressif.jpg",
    "minStock": 10,
    "order": 73
  },
  {
    "id": "consommables-74",
    "name": "patch/electrode DEA Phillips",
    "category": "consommables",
    "barcodes": [
      "010088483802370317270207102408070953"
    ],
    "image": "images/patch_DEA.jpg",
    "minStock": 5,
    "order": 74
  },
  {
    "id": "consommables-75",
    "name": "perf eau sterile",
    "category": "consommables",
    "barcodes": [
      "9000010000009"
    ],
    "image": "images/perf_eau_sterile.jpg",
    "minStock": 5,
    "order": 75
  },
  {
    "id": "consommables-76",
    "name": "perf NACL",
    "category": "consommables",
    "barcodes": [
      "0105413760145303172607001024174",
      "9000010000008"
    ],
    "image": "images/perf_NACL.jpg",
    "minStock": 5,
    "order": 76
  },
  {
    "id": "consommables-77",
    "name": "Pile AA",
    "category": "consommables",
    "barcodes": [
      "4008496882076"
    ],
    "image": "images/pile_AA.jpg",
    "minStock": 2,
    "order": 77
  },
  {
    "id": "consommables-78",
    "name": "pile AAA",
    "category": "consommables",
    "barcodes": [
      "5000394149199"
    ],
    "image": "images/pile_AAA.jpg",
    "minStock": 2,
    "order": 78
  },
  {
    "id": "consommables-79",
    "name": "pile cr2025",
    "category": "consommables",
    "barcodes": [
      "5000394203907"
    ],
    "image": "images/cr2025.jpg",
    "minStock": 2,
    "order": 79
  },
  {
    "id": "consommables-80",
    "name": "pince sat masimo",
    "category": "consommables",
    "barcodes": [
      "010084399701312311231001102324043252414325"
    ],
    "image": "images/pince_sat_masimo.jpg",
    "minStock": 2,
    "order": 80
  },
  {
    "id": "consommables-81",
    "name": "rasoir",
    "category": "consommables",
    "barcodes": [
      "9000010000005"
    ],
    "image": "images/rasoir.jpg",
    "minStock": 5,
    "order": 81
  },
  {
    "id": "consommables-82",
    "name": "rubalise",
    "category": "consommables",
    "barcodes": [],
    "image": "images/rubalise.jpg",
    "minStock": 1,
    "order": 82
  },
  {
    "id": "consommables-83",
    "name": "sac d'aspi",
    "category": "consommables",
    "barcodes": [
      "01064186850134081125012217300122101121716"
    ],
    "image": "images/sacaspi.jpg",
    "minStock": 10,
    "order": 83
  },
  {
    "id": "consommables-84",
    "name": "sac vomitoire",
    "category": "consommables",
    "barcodes": [
      "3760059230038",
      "3760059239550"
    ],
    "image": "images/sac_vomitoire.jpg",
    "minStock": 2,
    "order": 84
  },
  {
    "id": "consommables-85",
    "name": "scotch 3M",
    "category": "consommables",
    "barcodes": [
      "01040545967778421729121710107579224"
    ],
    "image": "images/scotch.jpg",
    "minStock": 5,
    "order": 85
  },
  {
    "id": "consommables-86",
    "name": "sucre",
    "category": "consommables",
    "barcodes": [
      "8711000329931",
      "5404009106452"
    ],
    "image": "images/sucre.jpg",
    "minStock": 1,
    "order": 86
  },
  {
    "id": "consommables-87",
    "name": "sonde aspi noir (ch. 10)",
    "category": "consommables",
    "barcodes": [],
    "image": "images/sonde10.jpg",
    "minStock": 5,
    "order": 87
  },
  {
    "id": "consommables-88",
    "name": "sonde aspi rouge (ch. 18)",
    "category": "consommables",
    "barcodes": [],
    "image": "images/sonde18.jpg",
    "minStock": 5,
    "order": 88
  },
  {
    "id": "consommables-89",
    "name": "sonde aspi verte (ch. 14)",
    "category": "consommables",
    "barcodes": [],
    "image": "images/sonde14.jpg",
    "minStock": 5,
    "order": 89
  },
  {
    "id": "consommables-90",
    "name": "royco",
    "category": "consommables",
    "barcodes": [],
    "image": "images/royco.jpg",
    "minStock": 2,
    "order": 90
  },
  {
    "id": "consommables-91",
    "name": "Speedblock",
    "category": "consommables",
    "barcodes": [],
    "image": "images/speedblock.jpg",
    "minStock": 2,
    "order": 91
  },
  {
    "id": "consommables-92",
    "name": "stethoscope",
    "category": "consommables",
    "barcodes": [
      "4250478405005",
      "3389360016072"
    ],
    "image": "images/stethoscope.jpg",
    "minStock": 1,
    "order": 92
  },
  {
    "id": "consommables-93",
    "name": "tensiomètre adulte",
    "category": "consommables",
    "barcodes": [
      "4002427000362"
    ],
    "image": "images/tensiometre_adulte.jpg",
    "minStock": 1,
    "order": 93
  },
  {
    "id": "consommables-94",
    "name": "tensiomètre baria",
    "category": "consommables",
    "barcodes": [
      "4002427000386"
    ],
    "image": "images/tensiometre_baria.jpg",
    "minStock": 1,
    "order": 94
  },
  {
    "id": "consommables-95",
    "name": "tensiometre pédia",
    "category": "consommables",
    "barcodes": [
      "4002427000362"
    ],
    "image": "images/tensiometre_pedia.jpg",
    "minStock": 1,
    "order": 95
  },
  {
    "id": "consommables-96",
    "name": "Thermomètre",
    "category": "consommables",
    "barcodes": [
      "4250478422941"
    ],
    "image": "images/thermometre.jpg",
    "minStock": 1,
    "order": 96
  },
  {
    "id": "consommables-97",
    "name": "tigette gluco",
    "category": "consommables",
    "barcodes": [
      "5021791708123",
      "5021791005512"
    ],
    "image": "images/tigette_gluco.jpg",
    "minStock": 3,
    "order": 97
  },
  {
    "id": "consommables-98",
    "name": "touillette",
    "category": "consommables",
    "barcodes": [
      "3760011957003"
    ],
    "image": "images/touillette.jpg",
    "minStock": 1,
    "order": 98
  },
  {
    "id": "consommables-99",
    "name": "trousse robinet perf",
    "category": "consommables",
    "barcodes": [
      "0108428820030175112401011727122710240058"
    ],
    "image": "images/robinet_perf.jpg",
    "minStock": 6,
    "order": 99
  },
  {
    "id": "consommables-100",
    "name": "tuyau d'aspi",
    "category": "consommables",
    "barcodes": [
      "780412"
    ],
    "image": "images/tuyauaspi.jpg",
    "minStock": 10,
    "order": 100
  },
  {
    "id": "desinfection-1",
    "name": "air citrea",
    "category": "desinfection",
    "barcodes": [
      "5425037710947"
    ],
    "image": "images/citrea.jpg",
    "minStock": 1,
    "order": 101
  },
  {
    "id": "desinfection-2",
    "name": "dettol",
    "category": "desinfection",
    "barcodes": [
      "5410036309551"
    ],
    "image": "images/dettol.jpg",
    "minStock": 3,
    "order": 102
  },
  {
    "id": "desinfection-2b",
    "name": "lingette umonium",
    "category": "desinfection",
    "barcodes": [
      "5425037713061"
    ],
    "image": "images/lingette.jpg",
    "minStock": 2,
    "order": 103
  },
  {
    "id": "desinfection-3",
    "name": "lunette protection",
    "category": "desinfection",
    "barcodes": [
      "8718158263049"
    ],
    "image": "images/lunette3m.jpg",
    "minStock": 2,
    "order": 104
  },
  {
    "id": "desinfection-4",
    "name": "sterilium gel",
    "category": "desinfection",
    "barcodes": [
      "4031678041970",
      "4031678086856"
    ],
    "image": "images/sterilium.jpg",
    "minStock": 5,
    "order": 105
  },
  {
    "id": "desinfection-5",
    "name": "umonium concentré",
    "category": "desinfection",
    "barcodes": [
      "5425037713122",
      "5425037710527"
    ],
    "image": "images/umo_con.jpg",
    "minStock": 2,
    "order": 106
  },
  {
    "id": "desinfection-6",
    "name": "umonium spray",
    "category": "desinfection",
    "barcodes": [
      "5425037713184"
    ],
    "image": "images/umo_spray.jpg",
    "minStock": 2,
    "order": 107
  },
  {
    "id": "divers-2",
    "name": "autocollants tpmr",
    "category": "divers",
    "barcodes": [],
    "image": "images/tpmr.jpg",
    "minStock": 1,
    "order": 108
  },
  {
    "id": "divers-3",
    "name": "cable DEFA",
    "category": "divers",
    "barcodes": [
      "7042284609213"
    ],
    "image": "images/defa.jpg",
    "minStock": 2,
    "order": 109
  },
  {
    "id": "divers-5",
    "name": "carnet kilometrique ambu",
    "category": "divers",
    "barcodes": [],
    "image": "images/km_ambu.jpg",
    "minStock": 5,
    "order": 110
  },
  {
    "id": "divers-7",
    "name": "Checklist",
    "category": "divers",
    "barcodes": [],
    "image": "images/check.jpg",
    "minStock": 5,
    "order": 111
  },
  {
    "id": "divers-8",
    "name": "constat européen d'accident",
    "category": "divers",
    "barcodes": [],
    "image": "images/cea.jpg",
    "minStock": 5,
    "order": 112
  },
  {
    "id": "divers-8b",
    "name": "détecteur CO",
    "category": "divers",
    "barcodes": [
      "065353"
    ],
    "image": "images/co.jpg",
    "minStock": 1,
    "order": 113
  },
  {
    "id": "divers-9",
    "name": "drapeau CRB",
    "category": "divers",
    "barcodes": [],
    "image": "images/drapeau.jpg",
    "minStock": 1,
    "order": 114
  },
  {
    "id": "divers-12",
    "name": "medica",
    "category": "divers",
    "barcodes": [
      "2639136"
    ],
    "image": "images/medica.jpg",
    "minStock": 1,
    "order": 115
  },
  {
    "id": "divers-13",
    "name": "pocket masque",
    "category": "divers",
    "barcodes": [
      "82001107"
    ],
    "image": "images/pocket.jpg",
    "minStock": 1,
    "order": 116
  },
  {
    "id": "divers-14",
    "name": "rallonge multiprise",
    "category": "divers",
    "barcodes": [
      "4007123647576"
    ],
    "image": "images/rallonge.jpg",
    "minStock": 1,
    "order": 117
  },
  {
    "id": "divers-15",
    "name": "sangle kaki civiere",
    "category": "divers",
    "barcodes": [],
    "image": "",
    "minStock": 2,
    "order": 118
  },
  {
    "id": "divers-16",
    "name": "saturomètre masimo",
    "category": "divers",
    "barcodes": [
      "1010084399701328411230901216000169255"
    ],
    "image": "images/satu.jpg",
    "minStock": 1,
    "order": 119
  },
  {
    "id": "divers-16b",
    "name": "saturomètre de poche",
    "category": "divers",
    "barcodes": [
      "8033622546177"
    ],
    "image": "images/satu1.jpg",
    "minStock": 1,
    "order": 120
  },
  {
    "id": "divers-1",
    "name": "attelle sam",
    "category": "DMP",
    "barcodes": [
      "01008220450010531020230109",
      "01008220450010531020230116"
    ],
    "image": "images/sam.jpg",
    "minStock": 2,
    "order": 121
  },
  {
    "id": "DMP-2",
    "name": "calmiderm",
    "category": "DMP",
    "barcodes": [
      "5420024600119"
    ],
    "image": "images/calmi.jpg",
    "minStock": 3,
    "order": 122
  },
  {
    "id": "DMP-3",
    "name": "extrapan",
    "category": "DMP",
    "barcodes": [],
    "image": "images/extrapan.jpg",
    "minStock": 2,
    "order": 123
  },
  {
    "id": "DMP-4",
    "name": "flamigel",
    "category": "DMP",
    "barcodes": [
      "5420013500291"
    ],
    "image": "images/flamigel.jpg",
    "minStock": 2,
    "order": 124
  },
  {
    "id": "entretien-1",
    "name": "adoucissant",
    "category": "entretien",
    "barcodes": [
      "5400141546606"
    ],
    "image": "images/adoucissant.jpg",
    "minStock": 3,
    "order": 125
  },
  {
    "id": "entretien-2",
    "name": "bloc wc",
    "category": "entretien",
    "barcodes": [
      "5410539202021"
    ],
    "image": "images/bloc_wc.jpg",
    "minStock": 1,
    "order": 126
  },
  {
    "id": "entretien-3",
    "name": "degraissant pro",
    "category": "entretien",
    "barcodes": [],
    "image": "images/degraissant.jpg",
    "minStock": 1,
    "order": 127
  },
  {
    "id": "entretien-4",
    "name": "degivrant vitre",
    "category": "entretien",
    "barcodes": [
      "4016264020797"
    ],
    "image": "images/degivrant.jpg",
    "minStock": 2,
    "order": 128
  },
  {
    "id": "entretien-5",
    "name": "désodorisant",
    "category": "entretien",
    "barcodes": [
      "7615400762828",
      "7615400829484"
    ],
    "image": "images/deso.jpg",
    "minStock": 2,
    "order": 129
  },
  {
    "id": "entretien-6",
    "name": "destop",
    "category": "entretien",
    "barcodes": [
      "5410036303092"
    ],
    "image": "images/destop.jpg",
    "minStock": 2,
    "order": 130
  },
  {
    "id": "entretien-7",
    "name": "eponge",
    "category": "entretien",
    "barcodes": [
      "5410616665367"
    ],
    "image": "images/eponge.jpg",
    "minStock": 3,
    "order": 131
  },
  {
    "id": "entretien-8",
    "name": "gel wc",
    "category": "entretien",
    "barcodes": [
      "5400141616347",
      "5400141354379",
      "5400141560756"
    ],
    "image": "images/gel_wc.jpg",
    "minStock": 3,
    "order": 132
  },
  {
    "id": "entretien-9",
    "name": "javel",
    "category": "entretien",
    "barcodes": [
      "5400141360561"
    ],
    "image": "images/javel.jpg",
    "minStock": 3,
    "order": 133
  },
  {
    "id": "entretien-10",
    "name": "lessive liquide",
    "category": "entretien",
    "barcodes": [
      "5400141796520"
    ],
    "image": "images/lessive_liquide.jpg",
    "minStock": 3,
    "order": 134
  },
  {
    "id": "entretien-11",
    "name": "liquide vaisselle",
    "category": "entretien",
    "barcodes": [
      "5400141193657"
    ],
    "image": "images/liquide_vaisselle.jpg",
    "minStock": 3,
    "order": 135
  },
  {
    "id": "entretien-12",
    "name": "nettoyant sol",
    "category": "entretien",
    "barcodes": [
      "5400141256253"
    ],
    "image": "images/sol.jpg",
    "minStock": 2,
    "order": 136
  },
  {
    "id": "entretien-13",
    "name": "nettoyant vitre",
    "category": "entretien",
    "barcodes": [
      "5400141257564"
    ],
    "image": "images/vitre.jpg",
    "minStock": 2,
    "order": 137
  },
  {
    "id": "entretien-14",
    "name": "papier tork",
    "category": "entretien",
    "barcodes": [
      "7322542014738"
    ],
    "image": "images/tork.jpg",
    "minStock": 10,
    "order": 138
  },
  {
    "id": "entretien-15",
    "name": "papier UU",
    "category": "entretien",
    "barcodes": [],
    "image": "images/papier_uu.jpg",
    "minStock": 10,
    "order": 139
  },
  {
    "id": "entretien-16",
    "name": "papier WC",
    "category": "entretien",
    "barcodes": [
      "3661679118303"
    ],
    "image": "images/pq.jpg",
    "minStock": 2,
    "order": 140
  },
  {
    "id": "entretien-17",
    "name": "sac ling contaminé rouge",
    "category": "entretien",
    "barcodes": [],
    "image": "images/sac_rouge.jpg",
    "minStock": 2,
    "order": 141
  },
  {
    "id": "entretien-18",
    "name": "sac linge contaminé jaune",
    "category": "entretien",
    "barcodes": [],
    "image": "images/sac_jaune.jpg",
    "minStock": 2,
    "order": 142
  },
  {
    "id": "entretien-19",
    "name": "sac pmc",
    "category": "entretien",
    "barcodes": [
      "5425038700077"
    ],
    "image": "images/sac_pmc.jpg",
    "minStock": 3,
    "order": 143
  },
  {
    "id": "entretien-20",
    "name": "sac poubelle ambu",
    "category": "entretien",
    "barcodes": [
      "5400141938074"
    ],
    "image": "images/sac_ambu.jpg",
    "minStock": 5,
    "order": 144
  },
  {
    "id": "entretien-21",
    "name": "sac poubelle noir",
    "category": "entretien",
    "barcodes": [],
    "image": "images/sac_noir.jpg",
    "minStock": 5,
    "order": 145
  },
  {
    "id": "entretien-22",
    "name": "savon main",
    "category": "entretien",
    "barcodes": [
      "5400141232295",
      "5400141411256",
      "5410306872303"
    ],
    "image": "images/savon_main.jpg",
    "minStock": 3,
    "order": 146
  },
  {
    "id": "entretien-23",
    "name": "torchon",
    "category": "entretien",
    "barcodes": [],
    "image": "images/torchon.jpg",
    "minStock": 10,
    "order": 147
  },
  {
    "id": "garage-1",
    "name": "ad blue",
    "category": "garage",
    "barcodes": [
      "3701239300011"
    ],
    "image": "images/adblue.jpg",
    "minStock": 3,
    "order": 148
  },
  {
    "id": "garage-2",
    "name": "allèse UU",
    "category": "garage",
    "barcodes": [
      "0113760061176840"
    ],
    "image": "images/allese.jpg",
    "minStock": 3,
    "order": 149
  },
  {
    "id": "garage-3",
    "name": "bouteilles d'eau (pack)",
    "category": "garage",
    "barcodes": [
      "3254381260110"
    ],
    "image": "images/eau.jpg",
    "minStock": 15,
    "order": 150
  },
  {
    "id": "garage-4",
    "name": "casque sécu secouriste",
    "category": "garage",
    "barcodes": [],
    "image": "images/casque.jpg",
    "minStock": 5,
    "order": 151
  },
  {
    "id": "garage-5",
    "name": "couverture UU",
    "category": "garage",
    "barcodes": [
      "4262431120016"
    ],
    "image": "images/couverture.jpg",
    "minStock": 3,
    "order": 152
  },
  {
    "id": "garage-6",
    "name": "lave glace été",
    "category": "garage",
    "barcodes": [
      "5412235020336"
    ],
    "image": "images/ete.jpg",
    "minStock": 3,
    "order": 153
  },
  {
    "id": "garage-7",
    "name": "lave glace hiver",
    "category": "garage",
    "barcodes": [
      "5412235165211"
    ],
    "image": "images/hiver.jpg",
    "minStock": 3,
    "order": 154
  },
  {
    "id": "garage-8",
    "name": "salopettes protection UU",
    "category": "garage",
    "barcodes": [
      "4260095090355"
    ],
    "image": "images/salopette_uu.jpg",
    "minStock": 20,
    "order": 155
  },
  {
    "id": "garage-9",
    "name": "shampoing carrosserie",
    "category": "garage",
    "barcodes": [
      "8712602000518"
    ],
    "image": "images/carrosserie.jpg",
    "minStock": 3,
    "order": 156
  },
  {
    "id": "garage-10",
    "name": "tablier protection MRSA jaune",
    "category": "garage",
    "barcodes": [],
    "image": "images/tablier.jpg",
    "minStock": 20,
    "order": 157
  },
  {
    "id": "vetements-1",
    "name": "Chaussures T 34",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 158
  },
  {
    "id": "vetements-2",
    "name": "Chaussures T 35",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 159
  },
  {
    "id": "vetements-3",
    "name": "Chaussures T 36",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 160
  },
  {
    "id": "vetements-4",
    "name": "Chaussures T 37",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 161
  },
  {
    "id": "vetements-5",
    "name": "Chaussures T 38",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 162
  },
  {
    "id": "vetements-6",
    "name": "Chaussures T 39",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 163
  },
  {
    "id": "vetements-7",
    "name": "Chaussures T 40",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 164
  },
  {
    "id": "vetements-8",
    "name": "Chaussures T 41",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 165
  },
  {
    "id": "vetements-9",
    "name": "Chaussures T 42",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 166
  },
  {
    "id": "vetements-10",
    "name": "Chaussures T 43",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 167
  },
  {
    "id": "vetements-11",
    "name": "Chaussures T 44",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 168
  },
  {
    "id": "vetements-12",
    "name": "Chaussures T 45",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 169
  },
  {
    "id": "vetements-13",
    "name": "Chaussures T 46",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 170
  },
  {
    "id": "vetements-14",
    "name": "Chaussures T 47",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 171
  },
  {
    "id": "vetements-15",
    "name": "Chaussures T 48",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 172
  },
  {
    "id": "vetements-16",
    "name": "Chaussures T 49",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 173
  },
  {
    "id": "vetements-17",
    "name": "Chaussures T 50",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 174
  },
  {
    "id": "vetements-18",
    "name": "Pantalon T 34",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 175
  },
  {
    "id": "vetements-20",
    "name": "Pantalon T 36",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 176
  },
  {
    "id": "vetements-22",
    "name": "Pantalon T 38",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 177
  },
  {
    "id": "vetements-24",
    "name": "Pantalon T 40",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 178
  },
  {
    "id": "vetements-26",
    "name": "Pantalon T 42",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 179
  },
  {
    "id": "vetements-28",
    "name": "Pantalon T 44",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 180
  },
  {
    "id": "vetements-30",
    "name": "Pantalon T 46",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 181
  },
  {
    "id": "vetements-32",
    "name": "Pantalon T 48",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 182
  },
  {
    "id": "vetements-34",
    "name": "Pantalon T 50",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 183
  },
  {
    "id": "vetements-36",
    "name": "Pantalon T 52",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 184
  },
  {
    "id": "vetements-38",
    "name": "Pantalon T 54",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 185
  },
  {
    "id": "vetements-40",
    "name": "Pantalon T 56",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 186
  },
  {
    "id": "vetements-42",
    "name": "Pantalon T 58",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 187
  },
  {
    "id": "vetements-44",
    "name": "Pantalon T 60",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 188
  },
  {
    "id": "vetements-45",
    "name": "Polo S",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 189
  },
  {
    "id": "vetements-46",
    "name": "Polo M",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 190
  },
  {
    "id": "vetements-47",
    "name": "Polo L",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 191
  },
  {
    "id": "vetements-48",
    "name": "Polo XL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 192
  },
  {
    "id": "vetements-49",
    "name": "Polo XXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 193
  },
  {
    "id": "vetements-50",
    "name": "Polo XXXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 194
  },
  {
    "id": "vetements-51",
    "name": "Softshell S",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 195
  },
  {
    "id": "vetements-52",
    "name": "Softshell M",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 196
  },
  {
    "id": "vetements-53",
    "name": "Softshell L",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 197
  },
  {
    "id": "vetements-54",
    "name": "Softshell XL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 198
  },
  {
    "id": "vetements-55",
    "name": "Softshell XXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 199
  },
  {
    "id": "vetements-56",
    "name": "Softshell XXXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 200
  },
  {
    "id": "vetements-57",
    "name": "T-shirt S",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 201
  },
  {
    "id": "vetements-58",
    "name": "T-shirt M",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 202
  },
  {
    "id": "vetements-59",
    "name": "T-shirt L",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 203
  },
  {
    "id": "vetements-60",
    "name": "T-shirt XL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 204
  },
  {
    "id": "vetements-61",
    "name": "T-shirt XXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 205
  },
  {
    "id": "vetements-62",
    "name": "T-shirt XXXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 206
  },
  {
    "id": "vetements-63",
    "name": "Veste S",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 207
  },
  {
    "id": "vetements-64",
    "name": "Veste M",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 208
  },
  {
    "id": "vetements-65",
    "name": "Veste L",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 209
  },
  {
    "id": "vetements-66",
    "name": "Veste XL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 210
  },
  {
    "id": "vetements-67",
    "name": "Veste XXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 211
  },
  {
    "id": "vetements-68",
    "name": "Veste XXXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 212
  },
  {
    "id": "vetements-69",
    "name": "Chaussures secouriste T 34",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 213
  },
  {
    "id": "vetements-70",
    "name": "Chaussures secouriste T 35",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 214
  },
  {
    "id": "vetements-71",
    "name": "Chaussures secouriste T 36",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 215
  },
  {
    "id": "vetements-72",
    "name": "Chaussures secouriste T 37",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 216
  },
  {
    "id": "vetements-73",
    "name": "Chaussures secouriste T 38",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 217
  },
  {
    "id": "vetements-74",
    "name": "Chaussures secouriste T 39",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 218
  },
  {
    "id": "vetements-75",
    "name": "Chaussures secouriste T 40",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 219
  },
  {
    "id": "vetements-76",
    "name": "Chaussures secouriste T 41",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 220
  },
  {
    "id": "vetements-77",
    "name": "Chaussures secouriste T 42",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 221
  },
  {
    "id": "vetements-78",
    "name": "Chaussures secouriste T 43",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 222
  },
  {
    "id": "vetements-79",
    "name": "Chaussures secouriste T 44",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 223
  },
  {
    "id": "vetements-80",
    "name": "Chaussures secouriste T 45",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 224
  },
  {
    "id": "vetements-81",
    "name": "Chaussures secouriste T 46",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 225
  },
  {
    "id": "vetements-82",
    "name": "Chaussures secouriste T 47",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 226
  },
  {
    "id": "vetements-83",
    "name": "Chaussures secouriste T 48",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 227
  },
  {
    "id": "vetements-84",
    "name": "Chaussures secouriste T 49",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 228
  },
  {
    "id": "vetements-85",
    "name": "Chaussures secouriste T 50",
    "category": "vetements",
    "barcodes": [],
    "image": "images/chaussures.jpg",
    "minStock": 0,
    "order": 229
  },
  {
    "id": "vetements-86",
    "name": "Pantalon secouriste T 34",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 230
  },
  {
    "id": "vetements-87",
    "name": "Pantalon secouriste T 36",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 231
  },
  {
    "id": "vetements-88",
    "name": "Pantalon secouriste T 38",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 232
  },
  {
    "id": "vetements-89",
    "name": "Pantalon secouriste T 40",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 233
  },
  {
    "id": "vetements-90",
    "name": "Pantalon secouriste T 42",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 234
  },
  {
    "id": "vetements-91",
    "name": "Pantalon secouriste T 44",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 235
  },
  {
    "id": "vetements-92",
    "name": "Pantalon secouriste T 46",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 236
  },
  {
    "id": "vetements-93",
    "name": "Pantalon secouriste T 48",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 237
  },
  {
    "id": "vetements-94",
    "name": "Pantalon secouriste T 50",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 238
  },
  {
    "id": "vetements-95",
    "name": "Pantalon secouriste T 52",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 239
  },
  {
    "id": "vetements-96",
    "name": "Pantalon secouriste T 54",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 240
  },
  {
    "id": "vetements-97",
    "name": "Pantalon secouriste T 56",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 241
  },
  {
    "id": "vetements-98",
    "name": "Pantalon secouriste T 58",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 242
  },
  {
    "id": "vetements-99",
    "name": "Pantalon secouriste T 60",
    "category": "vetements",
    "barcodes": [],
    "image": "images/pantalon.jpg",
    "minStock": 0,
    "order": 243
  },
  {
    "id": "vetements-100",
    "name": "Polo secouriste S",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 244
  },
  {
    "id": "vetements-101",
    "name": "Polo secouriste M",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 245
  },
  {
    "id": "vetements-102",
    "name": "Polo secouriste L",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 246
  },
  {
    "id": "vetements-103",
    "name": "Polo secouriste XL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 247
  },
  {
    "id": "vetements-104",
    "name": "Polo secouriste XXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 248
  },
  {
    "id": "vetements-105",
    "name": "Polo secouriste XXXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/polo.jpg",
    "minStock": 0,
    "order": 249
  },
  {
    "id": "vetements-106",
    "name": "Softshell secouriste S",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 250
  },
  {
    "id": "vetements-107",
    "name": "Softshell secouriste M",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 251
  },
  {
    "id": "vetements-108",
    "name": "Softshell secouriste L",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 252
  },
  {
    "id": "vetements-109",
    "name": "Softshell secouriste XL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 253
  },
  {
    "id": "vetements-110",
    "name": "Softshell secouriste XXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 254
  },
  {
    "id": "vetements-111",
    "name": "Softshell secouriste XXXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/softshell.jpg",
    "minStock": 0,
    "order": 255
  },
  {
    "id": "vetements-112",
    "name": "T-shirt secouriste S",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 256
  },
  {
    "id": "vetements-113",
    "name": "T-shirt secouriste M",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 257
  },
  {
    "id": "vetements-114",
    "name": "T-shirt secouriste L",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 258
  },
  {
    "id": "vetements-115",
    "name": "T-shirt secouriste XL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 259
  },
  {
    "id": "vetements-116",
    "name": "T-shirt secouriste XXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 260
  },
  {
    "id": "vetements-117",
    "name": "T-shirt secouriste XXXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/tshirt.jpg",
    "minStock": 0,
    "order": 261
  },
  {
    "id": "vetements-118",
    "name": "Veste secouriste S",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 262
  },
  {
    "id": "vetements-119",
    "name": "Veste secouriste M",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 263
  },
  {
    "id": "vetements-120",
    "name": "Veste secouriste L",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 264
  },
  {
    "id": "vetements-121",
    "name": "Veste secouriste XL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 265
  },
  {
    "id": "vetements-122",
    "name": "Veste secouriste XXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 266
  },
  {
    "id": "vetements-123",
    "name": "Veste secouriste XXXL",
    "category": "vetements",
    "barcodes": [],
    "image": "images/veste.jpg",
    "minStock": 0,
    "order": 267
  }
];

