import { Field, FieldContent, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'

export function SettingSwitch({
	id,
	label,
	checked,
	onCheckedChange,
}: {
	id: string
	label: string
	checked: boolean
	onCheckedChange: (checked: boolean) => void
}) {
	return (
		<Field orientation='horizontal'>
			<FieldContent>
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
			</FieldContent>
			<Switch
				id={id}
				checked={checked}
				onCheckedChange={onCheckedChange}
			/>
		</Field>
	)
}
