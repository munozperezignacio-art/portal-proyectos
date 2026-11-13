// Presentation only: never rewrite the field used for lookups or persistence.
export function fillSections(groups) {
  let previous = '';
  return groups.flatMap(group => {
    const label = group.field.label || '';
    const separator = label.indexOf(' · ');
    const section = group.rows ? group.title : separator > 0 ? label.slice(0, separator).trim() : '';
    const heading = section && section !== previous ? [{heading: section, key: 'section-' + group.field.id}] : [];
    previous = section;
    return [...heading, {...group, shortLabel: section && !group.rows ? label.slice(separator + 3).trim() : label}];
  });
}
