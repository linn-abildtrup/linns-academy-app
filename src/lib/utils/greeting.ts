// Tidsbestemt hilsen baseret på klokkeslæt.
// Grænser: 5-10 = Godmorgen, 10-12 = God formiddag, 12-18 = God eftermiddag, 18-5 = Godaften.

export function getGreeting(date: Date = new Date()): string {
	const hour = date.getHours();

	if (hour >= 5 && hour < 10) {
		return 'Godmorgen';
	}
	if (hour >= 10 && hour < 12) {
		return 'God formiddag';
	}
	if (hour >= 12 && hour < 18) {
		return 'God eftermiddag';
	}
	return 'Godaften';
}

export function getGreetingWithName(name: string, date: Date = new Date()): string {
	const greeting = getGreeting(date);
	if (!name) {
		return greeting;
	}
	return greeting + ', ' + name;
}
