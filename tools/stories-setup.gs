// One-time setup: fills the "Stories" tab with the first stories.
// Run setupStoryLibrary() once from the Apps Script editor. It does nothing if
// the tab already has stories, so running it again is safe.
// Iza replaces the placeholder stories over time, right in the sheet.

var STARTER_STORIES = [
  ["2026-11-15", "ready", "Death in Tehran", "escaping our fate",
    "A rich Persian was walking in his garden one morning when his servant came running to him, pale and shaking.\n\n" +
    "\"Master, I have just seen Death standing among the trees, and he was looking at me. My time has come. Please, give me your fastest horse. If I ride all day, I can be in Tehran by nightfall, and he will never find me there.\"\n\n" +
    "The master gave him the horse, and the servant rode off as fast as it would carry him.\n\n" +
    "That afternoon the master walked into the garden and met Death himself. \"Why did you frighten my servant like that?\" he asked.\n\n" +
    "\"I didn't come for him here,\" said Death. \"I was only surprised to see him. You see, we are meant to meet tonight, in Tehran.\"",
    "An old Persian tale, retold. Viktor Frankl tells it in Man's Search for Meaning.",
    "What do you think this story says about the nature of fate?"],

  ["2026-11-22", "ready", "The Farmer's Horse", "good and bad luck",
    "An old farmer lived at the edge of the steppe with his son and one horse. One day the horse ran away. The neighbours came by and said, \"What bad luck.\" The farmer said, \"Maybe.\"\n\n" +
    "A week later the horse came home, and it brought a wild mare with it. \"What good luck,\" said the neighbours. \"Maybe,\" said the farmer.\n\n" +
    "His son tried to ride the wild mare, fell, and broke his leg. \"What bad luck,\" said the neighbours. \"Maybe,\" said the farmer.\n\n" +
    "That autumn soldiers came through the village and took every young man off to war. They left the son behind, because of his leg. \"What good luck,\" said the neighbours.\n\n" +
    "The farmer only said, \"Maybe.\"",
    "An old Chinese tale, retold. It first appears in the Huainanzi, about 2,100 years ago.",
    "When did something that looked like bad luck turn out to be a gift for you?"],

  ["2026-11-29", "ready", "The Mustard Seed", "grief",
    "A young mother named Kisa lost her only child. Mad with grief, she carried the little body from house to house, asking everyone for a medicine to bring him back.\n\n" +
    "At last she came to a wise teacher. \"I can help you,\" he said. \"Bring me one mustard seed, but it must come from a house where nobody has ever died.\"\n\n" +
    "Kisa ran to the village. At every door the people gladly offered her mustard seed. But when she asked, \"Has anyone died in this house?\", each family told her about a father, a sister, a child.\n\n" +
    "By evening her hands were still empty. She sat down at the edge of the village, and for the first time she understood that she was not alone in her loss. She buried her son and went back to the teacher, quiet now.",
    "An old Buddhist tale, retold. It is told about Kisa Gotami, who lived in India about 2,500 years ago.",
    "What helps you carry a loss: being alone with it, or seeing that others carry it too?"],

  ["2026-12-06", "ready", "Two Monks and a River", "letting go",
    "Two monks were walking home through the rain when they came to a swollen river. On the bank stood a young woman in a silk dress, afraid to cross.\n\n" +
    "The older monk picked her up without a word, carried her through the water and set her down on the other side. She thanked him and went on her way.\n\n" +
    "The younger monk walked on in silence for hours. Monks were not supposed to touch women, and it ate at him. At last he burst out, \"How could you carry her?\"\n\n" +
    "The older monk smiled. \"I put her down on the riverbank this morning. Why are you still carrying her?\"",
    "An old Zen tale, retold. It is told about the Japanese monk Tanzan.",
    "What are you still carrying that you could put down on the riverbank?"],

  ["2026-12-13", "ready", "Stone Soup", "sharing",
    "A tired traveller came into a village one cold evening with nothing but an empty pot. Nobody would give him food, so he filled the pot with water from the well, dropped in a smooth stone and set it over a fire in the square.\n\n" +
    "A woman asked what he was cooking. \"Stone soup,\" he said. \"It's very good, though a carrot would make it better.\" She brought a carrot.\n\n" +
    "A man brought an onion. Someone brought a few potatoes, then a bit of salt, then a bone, then a handful of barley. Soon the whole village stood around the pot.\n\n" +
    "When the soup was ready, there was enough for everyone. The traveller fished out his stone, put it in his pocket, and went on his way.",
    "A European folk tale, retold. It is told in many countries, with an axe, a nail or a stone.",
    "What could you start this winter that others would add to?"],

  ["2026-12-20", "ready", "Morozko", "kindness and greed",
    "A stepmother hated her husband's daughter, so in the deepest cold of winter she made the old man take the girl into the forest and leave her under a fir tree.\n\n" +
    "Morozko, the frost spirit, came leaping through the branches. \"Are you warm, girl?\" he asked, and the cold grew sharper. \"I am warm, Grandfather Frost,\" she said, though she could barely move her lips. He asked three times, and three times she answered kindly. Morozko was so pleased that he wrapped her in furs and gave her a chest full of gifts.\n\n" +
    "When the stepmother saw this, she sent her own daughter to the same tree. Morozko asked her, \"Are you warm, girl?\" \"Can't you see I'm freezing, you old fool?\" she snapped.\n\n" +
    "In the morning the old man brought home only her stiff, frozen body.",
    "A Russian folk tale, retold. Alexander Afanasyev wrote it down in the 1850s.",
    "Why do you think the old stories reward the one who stays gentle when life is cruel?"],

  ["2026-12-27", "ready", "The Twelve Months", "patience",
    "A cruel stepmother sent her stepdaughter Marushka out into the January snow to bring back violets.\n\n" +
    "Marushka wandered until she saw a fire on a mountain top. Twelve men sat around it, the twelve months of the year. Old January held the staff. When she told them why she had come, January handed his staff to young March, and for a moment the snow melted and violets bloomed. She thanked them and went home.\n\n" +
    "Next she was sent for strawberries, then for apples, and each time the months helped her because she spoke to them with respect.\n\n" +
    "Then her greedy stepsister went up the mountain herself. She pushed her way to the fire and demanded what she wanted without a greeting. January raised his staff, and a storm of snow swallowed her.",
    "A Czech and Slovak folk tale, retold. Božena Němcová wrote it down in the 1800s.",
    "Which season are you in right now, and what would it mean to wait for the next one?"],

  ["2027-01-03", "ready", "The Bundle of Sticks", "staying together",
    "An old father had sons who quarrelled all day long. One evening he called them together and handed them a bundle of sticks tied with string. \"Break it,\" he said.\n\n" +
    "Each son tried with all his strength. Nobody could break the bundle.\n\n" +
    "Then the father untied the string and gave each son one stick. They snapped them easily.\n\n" +
    "\"You see,\" he said. \"Together, nobody can break you. Apart, anyone can.\"",
    "An old fable, retold. It is one of Aesop's, from ancient Greece.",
    "Who are the sticks in your bundle?"]
];

function setupStoryLibrary() {
  var sheet = storiesSheet_();
  if (sheet.getLastRow() > 1) {
    SpreadsheetApp.getActiveSpreadsheet().toast("The Stories tab already has stories, so nothing was added.", "Newsletter");
    return;
  }
  STARTER_STORIES.forEach(function (story) {
    var row = story.slice();
    row[0] = new Date(row[0] + "T12:00:00");
    sheet.appendRow(row);
  });
  sheet.getRange(2, 1, STARTER_STORIES.length, 1).setNumberFormat("yyyy-mm-dd");
  sheet.getRange("B2:B").setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["ready", "draft", "sent"], true).setAllowInvalid(true).build());
}
