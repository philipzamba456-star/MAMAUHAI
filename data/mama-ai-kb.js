// Offline maternal health knowledge base for Mama AI.
// Each entry is matched against the mother's question using simple keyword
// overlap (see routes/mama-ai.js). This is intentionally NOT a general
// conversational AI — it's a searchable FAQ collection so the assistant can
// keep working with no internet connection and no API key.

module.exports = [
  // ---------------------------------------------------------------- pregnancy
  {
    category: 'pregnancy',
    keywords: ['normal', 'symptom', 'nausea', 'morning sickness', 'sick', 'vomit'],
    question: 'Is nausea or morning sickness normal in pregnancy?',
    answer: "Yes, nausea (often called morning sickness, even though it can happen any time of day) is very common in the first trimester. Eating small, frequent meals, keeping crackers by your bed, sipping ginger tea, and staying hydrated often help. It usually eases by around week 12-14. If you can't keep any food or fluids down for over 24 hours, that needs medical attention.",
  },
  {
    category: 'pregnancy',
    keywords: ['swelling', 'ankle', 'feet', 'swollen', 'edema'],
    question: 'Is swelling in my ankles or feet normal?',
    answer: 'Mild swelling in the feet and ankles, especially later in pregnancy, is common because your body holds more fluid. Resting with your feet raised, staying hydrated, and avoiding standing for long periods can help. However, sudden or severe swelling — especially in the face and hands, together with headache or vision changes — can be a warning sign and needs urgent medical attention.',
  },
  {
    category: 'pregnancy',
    keywords: ['back pain', 'backache', 'pain in back'],
    question: 'Why do I have back pain during pregnancy?',
    answer: 'Back pain is common as your belly grows and your posture shifts, and as pregnancy hormones loosen the ligaments supporting your spine. Gentle stretching, good posture, a supportive pillow when sleeping, and avoiding heavy lifting can help. If the pain is severe, sudden, or comes with fever or bleeding, seek care right away.',
  },
  {
    category: 'pregnancy',
    keywords: ['heartburn', 'acid reflux', 'indigestion'],
    question: 'How can I manage heartburn during pregnancy?',
    answer: 'Heartburn is common as your growing womb puts pressure on your stomach. Eating smaller meals, avoiding spicy or fatty foods late in the day, not lying down right after eating, and staying upright for a while after meals often helps.',
  },
  {
    category: 'pregnancy',
    keywords: ['exercise', 'workout', 'active', 'physical activity'],
    question: 'Can I exercise while pregnant?',
    answer: "In most uncomplicated pregnancies, light to moderate exercise like walking, swimming, or prenatal yoga is safe and can help with sleep, mood, and delivery. Avoid activities with a high fall risk or that involve lying flat on your back for long periods after the first trimester. Stop and rest if you feel dizzy, short of breath, or notice any pain.",
  },
  {
    category: 'pregnancy',
    keywords: ['sleep', 'trouble sleeping', 'insomnia', 'cant sleep'],
    question: 'Why is it hard to sleep during pregnancy?',
    answer: 'Trouble sleeping is common, especially in the later months, due to a growing belly, needing the bathroom more often, and hormone changes. Sleeping on your left side with a pillow between your knees, limiting fluids before bed, and keeping a calming bedtime routine can help.',
  },

  // ---------------------------------------------------------------- nutrition
  {
    category: 'nutrition',
    keywords: ['eat', 'diet', 'nutrition', 'food', 'what should i eat'],
    question: 'What should I eat during pregnancy?',
    answer: 'Focus on a variety of foods: whole grains (like posho, millet, brown rice), beans and legumes for protein and iron, leafy greens (like dodo, nakati), fruits, eggs, fish, and dairy if available. Iron-rich foods help prevent anemia, and folate-rich foods (greens, beans) support your baby\'s development. Try to eat something small every few hours rather than large infrequent meals.',
  },
  {
    category: 'nutrition',
    keywords: ['avoid', 'foods to avoid', 'not eat', 'unsafe food'],
    question: 'What foods should I avoid during pregnancy?',
    answer: 'Avoid raw or undercooked meat and eggs, unpasteurized dairy, excess caffeine, alcohol, and raw fish. Wash fruits and vegetables well and make sure meat and eggs are fully cooked to reduce the risk of foodborne illness.',
  },
  {
    category: 'nutrition',
    keywords: ['iron', 'anemia', 'anaemia', 'blood', 'weak', 'tired'],
    question: 'How can I prevent anemia during pregnancy?',
    answer: 'Anemia is common in pregnancy because your body needs more iron to support your growing baby. Eating iron-rich foods (beans, liver, leafy greens, meat) alongside vitamin C-rich foods (like oranges or tomatoes, which help iron absorption) helps. Your antenatal clinic will usually also give you iron and folic acid supplements — take them as directed.',
  },
  {
    category: 'nutrition',
    keywords: ['water', 'hydration', 'drink', 'fluids'],
    question: 'How much water should I drink while pregnant?',
    answer: 'Aim for around 8-10 cups (roughly 2 liters) of water a day, more if it\'s hot or you\'re active. Good hydration helps with energy, digestion, and can reduce swelling and headaches.',
  },
  {
    category: 'nutrition',
    keywords: ['breastfeeding diet', 'eat while breastfeeding', 'nursing mother food'],
    question: 'What should I eat while breastfeeding?',
    answer: 'Keep eating a varied, balanced diet similar to pregnancy — extra protein, calcium, and iron-rich foods help support milk production and your own recovery. Drink plenty of water, especially since breastfeeding increases your fluid needs.',
  },

  // --------------------------------------------------------------- medications
  {
    category: 'medications',
    keywords: ['paracetamol', 'panadol', 'pain relief', 'headache medicine'],
    question: 'Can I take paracetamol during pregnancy?',
    answer: 'Paracetamol (Panadol) is generally considered the safest over-the-counter pain reliever during pregnancy when taken at the recommended dose. Avoid ibuprofen and aspirin unless specifically advised by your doctor, especially in the third trimester. Always check with your antenatal clinic before taking any new medication.',
  },
  {
    category: 'medications',
    keywords: ['folic acid', 'supplement', 'vitamins', 'prenatal vitamin'],
    question: 'What supplements should I take during pregnancy?',
    answer: 'Folic acid and iron are the two most commonly recommended supplements in pregnancy — folic acid helps prevent birth defects (ideally started before conception and continued through the first trimester), and iron helps prevent anemia. Your antenatal clinic will usually provide these along with a schedule for taking them.',
  },
  {
    category: 'medications',
    keywords: ['malaria', 'antimalarial', 'sp', 'ipt'],
    question: 'Is malaria prevention medication safe in pregnancy?',
    answer: 'Yes — in malaria-endemic areas like Uganda, intermittent preventive treatment (IPTp, usually with Sulfadoxine-Pyrimethamine) is routinely given during antenatal visits and is considered safe and important, since malaria during pregnancy can be serious for both mother and baby. Sleeping under a treated mosquito net is also strongly recommended.',
  },

  // -------------------------------------------------------------- antenatal care
  {
    category: 'antenatal',
    keywords: ['antenatal', 'anc', 'checkup', 'clinic visit', 'how often'],
    question: 'How often should I go for antenatal checkups?',
    answer: 'The WHO and Uganda\'s Ministry of Health recommend at least 8 antenatal contacts during pregnancy: starting as early as possible (ideally before 12 weeks), then roughly monthly until 28 weeks, every 2 weeks until 36 weeks, and weekly after that until delivery. Each visit checks your health and your baby\'s growth and can catch problems early.',
  },
  {
    category: 'antenatal',
    keywords: ['first visit', 'when start antenatal', 'first checkup'],
    question: 'When should I start antenatal care?',
    answer: 'As soon as you know or suspect you\'re pregnant — ideally within the first 12 weeks. Early antenatal care lets your provider confirm your due date, check for risk factors, and start you on important supplements and preventive treatments early.',
  },
  {
    category: 'antenatal',
    keywords: ['ultrasound', 'scan'],
    question: 'How many ultrasound scans do I need?',
    answer: 'Most uncomplicated pregnancies have at least one ultrasound scan, often around 18-22 weeks to check the baby\'s growth and development. Your provider may recommend more scans if there are any concerns or risk factors.',
  },

  // -------------------------------------------------------------- danger signs
  {
    category: 'danger_signs',
    emergency: true,
    keywords: ['bleeding', 'blood', 'heavy bleeding'],
    question: 'What if I have vaginal bleeding during pregnancy?',
    answer: 'Any heavy vaginal bleeding during pregnancy is a warning sign that needs urgent medical attention — please go to the nearest hospital or health facility right away, or contact your doctor or health worker immediately. Light spotting can sometimes be normal, especially early in pregnancy, but heavy bleeding should never be ignored.',
  },
  {
    category: 'danger_signs',
    emergency: true,
    keywords: ['no movement', 'baby not moving', 'reduced movement', 'fetal movement'],
    question: 'What if I notice reduced or no baby movement?',
    answer: 'If you notice your baby is moving much less than usual, or you feel no movement over several hours where you\'d normally expect it (typically from around 28 weeks), this needs prompt medical attention. Go to your nearest health facility or contact your provider right away — don\'t wait it out.',
  },
  {
    category: 'danger_signs',
    emergency: true,
    keywords: ['severe headache', 'vision', 'blurred vision', 'preeclampsia', 'pre-eclampsia'],
    question: 'What if I have a severe headache with vision changes?',
    answer: 'A severe headache together with vision changes (blurring, seeing spots) and/or swelling of the face and hands can be signs of pre-eclampsia, a serious pregnancy condition. This needs urgent medical attention — please go to a health facility right away.',
  },
  {
    category: 'danger_signs',
    emergency: true,
    keywords: ['difficulty breathing', 'shortness of breath', 'cant breathe', 'breathless'],
    question: 'What if I have serious difficulty breathing?',
    answer: 'Serious or sudden difficulty breathing during pregnancy is an emergency and needs immediate medical care — go to the nearest hospital right away or call for emergency help.',
  },
  {
    category: 'danger_signs',
    emergency: true,
    keywords: ['convulsion', 'seizure', 'fainting', 'faint', 'unconscious'],
    question: 'What if I have convulsions or fainting?',
    answer: 'Convulsions or fainting during pregnancy are emergencies that need immediate medical attention — go to the nearest hospital right away or call for emergency help.',
  },
  {
    category: 'danger_signs',
    keywords: ['severe abdominal pain', 'stomach pain', 'belly pain'],
    emergency: true,
    question: 'What if I have severe abdominal pain?',
    answer: 'Severe, unrelenting abdominal pain during pregnancy needs urgent medical attention — please go to your nearest health facility right away.',
  },
  {
    category: 'danger_signs',
    keywords: ['fever', 'high temperature'],
    question: 'What if I have a fever during pregnancy?',
    answer: 'A fever during pregnancy should not be ignored, especially if it is high or lasts more than a day, as it can sometimes indicate an infection that needs treatment. Rest, stay hydrated, and take paracetamol at the recommended dose, but contact your health worker or clinic if the fever is high, persistent, or comes with other symptoms.',
  },

  // -------------------------------------------------------------- breastfeeding
  {
    category: 'breastfeeding',
    keywords: ['breastfeed', 'breastfeeding', 'nursing', 'latch'],
    question: 'How do I get my baby to latch properly?',
    answer: 'A good latch means your baby\'s mouth covers not just the nipple but a good portion of the areola, with lips flanged outward. Support your breast with your hand, bring baby to the breast (not breast to baby), and aim their nose toward your nipple so they tilt their head back slightly to latch deeply. If it hurts throughout the feed, gently break the latch and try again — persistent pain is worth discussing with a health worker.',
  },
  {
    category: 'breastfeeding',
    keywords: ['milk supply', 'not enough milk', 'low milk'],
    question: 'What if I feel I don\'t have enough breast milk?',
    answer: 'Milk supply usually builds up in response to how often and effectively your baby feeds. Frequent feeding (8-12 times a day for newborns), skin-to-skin contact, staying hydrated and well-fed, and getting rest when possible all support supply. If your baby isn\'t gaining weight well or having enough wet diapers, see a health worker for support.',
  },
  {
    category: 'breastfeeding',
    keywords: ['sore nipple', 'cracked nipple', 'nipple pain'],
    question: 'What can I do about sore or cracked nipples?',
    answer: 'Sore nipples often come from a shallow latch. Correcting the latch is the most important fix. Letting nipples air-dry after feeds, applying a little expressed breast milk, and using a lanolin-based cream can help soothe soreness in the meantime.',
  },
  {
    category: 'breastfeeding',
    keywords: ['how long breastfeed', 'exclusive breastfeeding', 'when stop'],
    question: 'How long should I breastfeed for?',
    answer: 'The WHO recommends exclusive breastfeeding (breast milk only, no water or other foods) for the first 6 months, then continued breastfeeding alongside appropriate complementary foods up to 2 years or beyond.',
  },

  // -------------------------------------------------------------- newborn care
  {
    category: 'newborn_care',
    keywords: ['umbilical cord', 'cord care', 'navel'],
    question: 'How do I care for my newborn\'s umbilical cord?',
    answer: 'Keep the umbilical cord stump clean and dry until it falls off on its own, usually within 1-2 weeks. Avoid applying anything unnecessary to it, fold the diaper below the stump to avoid irritation, and watch for redness, swelling, foul smell, or discharge, which need medical attention.',
  },
  {
    category: 'newborn_care',
    keywords: ['newborn sleep', 'baby sleep', 'how much sleep'],
    question: 'How much should a newborn sleep?',
    answer: 'Newborns typically sleep 14-17 hours a day, in short stretches of 2-4 hours, waking frequently to feed. This is normal and gradually settles into longer stretches over the following months. Always place baby on their back to sleep, on a firm surface, without loose bedding.',
  },
  {
    category: 'newborn_care',
    keywords: ['newborn jaundice', 'yellow skin', 'jaundice'],
    question: 'What if my newborn looks yellow (jaundice)?',
    answer: 'Mild jaundice (yellowing of the skin or eyes) in the first week is common and often resolves on its own with frequent feeding. However, if it appears within the first 24 hours of life, spreads to the arms and legs, or the baby seems very sleepy or feeds poorly, seek medical attention promptly.',
  },
  {
    category: 'newborn_care',
    keywords: ['bathing baby', 'bath newborn', 'wash baby'],
    question: 'How often should I bathe my newborn?',
    answer: 'A newborn doesn\'t need a daily bath — 2-3 times a week is usually enough, using warm water and mild soap, in a warm room. Sponge baths are recommended until the umbilical cord stump falls off.',
  },

  // -------------------------------------------------------------- family planning
  {
    category: 'family_planning',
    keywords: ['family planning', 'contraception', 'birth control', 'spacing'],
    question: 'What family planning options are available after delivery?',
    answer: 'Common options in Uganda include injectable contraceptives (like Depo-Provera), implants, pills, IUDs, and condoms. Some methods are safe to start soon after delivery, even while breastfeeding (like the progestin-only pill, implants, or IUDs). A health worker can help you choose based on your health, breastfeeding status, and preferences.',
  },
  {
    category: 'family_planning',
    keywords: ['spacing pregnancies', 'wait before next pregnancy', 'how long between'],
    question: 'How long should I wait before my next pregnancy?',
    answer: 'Health guidance generally recommends waiting at least 18-24 months after a birth before the next pregnancy, to allow your body to recover and to support the best health outcomes for both you and your children.',
  },

  // -------------------------------------------------------------- vaccinations
  {
    category: 'vaccinations',
    keywords: ['tetanus', 'tt vaccine', 'tetanus toxoid'],
    question: 'Why do I need a tetanus vaccine during pregnancy?',
    answer: 'The tetanus toxoid vaccine protects both you and your newborn from tetanus, which can be life-threatening, especially around delivery. It\'s routinely given during antenatal visits — your health worker will let you know your vaccination schedule.',
  },
  {
    category: 'vaccinations',
    keywords: ['baby vaccine', 'immunization', 'immunisation', 'vaccination schedule'],
    question: 'What vaccines does my baby need?',
    answer: 'In Uganda, the routine immunization schedule includes BCG and OPV at birth, followed by doses of pentavalent, pneumococcal, rotavirus, and other vaccines at 6, 10, and 14 weeks, with measles-rubella and other vaccines around 9 months. Your local health center or health worker will have the full schedule and can track your baby\'s progress on their immunization card.',
  },

  // -------------------------------------------------------------- postpartum
  {
    category: 'postpartum',
    keywords: ['postpartum', 'after delivery', 'recovery', 'after birth'],
    question: 'What is normal recovery like after delivery?',
    answer: 'It\'s normal to experience vaginal bleeding (lochia) that gradually lightens over 4-6 weeks, cramping as the uterus shrinks back down, and fatigue. Rest as much as possible, eat well, and attend your postpartum checkups. Heavy bleeding that soaks a pad in under an hour, foul-smelling discharge, or fever need urgent medical attention.',
  },
  {
    category: 'postpartum',
    keywords: ['postpartum depression', 'mood', 'sad after birth', 'baby blues'],
    question: 'Is it normal to feel sad or overwhelmed after having a baby?',
    answer: '"Baby blues" — feeling weepy, overwhelmed, or anxious in the first couple weeks after birth — is very common and usually passes on its own with rest and support. But if low mood, anxiety, or feeling disconnected from your baby lasts more than two weeks, or feels severe, that could be postpartum depression, which is treatable — please reach out to a health worker or doctor. If you ever have thoughts of harming yourself or your baby, seek help immediately — this is a medical emergency.',
  },
  {
    category: 'postpartum',
    keywords: ['stitches', 'episiotomy', 'perineal pain', 'csection recovery', 'c-section'],
    question: 'How do I care for stitches or a C-section wound after delivery?',
    answer: 'Keep the area clean and dry, and follow your provider\'s wound care instructions. For vaginal stitches, warm water rinses after using the toilet can help comfort and hygiene. For a C-section wound, watch for increasing redness, swelling, warmth, or discharge, which need medical attention. Avoid heavy lifting until your provider clears you.',
  },
];
