import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'service-account-key.json'), 'utf-8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const FORLOB = process.argv[2] ?? 'kropsro_maj_2026';
const KORTE_NAVNE: Record<string, string> = {
	goblet_squat: 'Goblet squat',
	glute_bridge: 'Glute bridge KB',
	glute_bridge_nv: 'Glute bridge',
	incline_pushup: 'Incline push-up',
	calf_raise: 'Calf raise',
	sumo_squat: 'Sumo squat',
	superman: 'Superman',
	planke: 'Planke',
	lateral_lunge: 'Lateral lunge',
	dodloft_kettlebell: 'Dødløft KB',
	curtsy_lunge: 'Curtsy lunge',
	bent_over_row: 'Bent-over row KB',
	bird_dog: 'Bird dog',
	dips_chair: 'Dips på stol',
	reverse_lunge: 'Reverse lunge KB',
	reverse_lunge_nv: 'Reverse lunge',
	dead_bug: 'Dead bug',
	step_up: 'Step-up KB',
	step_up_nv: 'Step-up',
	side_plank_left: 'Side plank V',
	side_plank_right: 'Side plank H',
	cat_cow: 'Cat-cow',
	good_morning: 'Good morning',
	lunges_rotation: 'Lunge rotation',
	ankelstraek_left: 'Ankelstræk V',
	ankelstraek_right: 'Ankelstræk H',
	shoulder_taps: 'Shoulder taps',
	split_squat_left: 'Split squat V',
	split_squat_right: 'Split squat H',
	mavebojninger: 'Mavebøjning',
	maveboejninger: 'Mavebøjning',
	russian_twist: 'Russian twist',
	russian_twist_kettlebell: 'Russian twist KB',
	mavelaeggende_armfoering: 'Maveliggende armf.',
	single_leg_glute_bridge_left: 'SL glute bridge V',
	single_leg_glute_bridge_right: 'SL glute bridge H',
	shoulder_press: 'Shoulder press KB',
	bodyweight_squat: 'Bodyweight squat',
	thruster: 'Thruster KB',
	inchworm: 'Inchworm',
	mini_hops: 'Mini hops',
	wall_sit: 'Wall sit',
	wall_sit_kettlebell: 'Wall sit KB',
	burpees: 'Burpee',
	sumo_dodloft: 'Sumo dødløft KB',
	romanian_deadlift_kettlebell: 'Romanian DL KB',
	kettlebell_swing: 'KB swing',
	kettlebell_high_pulls: 'KB high pull',
	kettlebell_figure_8: 'KB figure-8',
	wood_chop_left: 'Wood chop V',
	wood_chop_right: 'Wood chop H',
	floor_press_kettlebell: 'Floor press KB',
	single_leg_deadlift_left: 'SL deadlift V',
	single_leg_deadlift_right: 'SL deadlift H',
	single_leg_deadlift_kettlebell_left: 'SL deadlift KB V',
	single_leg_deadlift_kettlebell_right: 'SL deadlift KB H',
	single_leg_stand_left: 'SL stand V',
	single_leg_stand_right: 'SL stand H',
	step_up_knee_lift: 'Step-up knæløft',
	suitcase_deadlift_left: 'Suitcase DL V',
	suitcase_deadlift_right: 'Suitcase DL H',
	single_arm_row_kettlebell_left: 'SA row KB V',
	single_arm_row_kettlebell_right: 'SA row KB H'
};

function kort(id: string): string {
	return KORTE_NAVNE[id] ?? id;
}

for (const programId of ['kropsro_84_med_kb', 'kropsro_84_uden_kb']) {
	const pgmRef = db.collection(`forlob/${FORLOB}/mikrotraeningProgrammer`).doc(programId);
	const pgm = await pgmRef.get();
	const pData = pgm.data();
	if (!pData) continue;
	console.log(`\n### ${pData.navn}\n`);
	console.log('| Dag | Titel | Øvelser |');
	console.log('|---:|---|---|');
	const daysSnap = await pgmRef.collection('days').orderBy('dagNummer').get();
	for (const d of daysSnap.docs) {
		const day = d.data();
		const titel = (day.titel ?? '').replace('Styrke · ', '').replace('Mobilitet · ', '');
		const exs = (day.exercises ?? []) as { exerciseId: string }[];
		const navne = exs.map((e) => kort(e.exerciseId)).join(', ');
		console.log(`| ${day.dagNummer} | ${titel} | ${navne} |`);
	}
}
process.exit(0);
