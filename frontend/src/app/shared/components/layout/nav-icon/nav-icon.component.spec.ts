import { TestBed } from '@angular/core/testing';
import { NavIconComponent } from './nav-icon.component';
import type { NavIcon } from '../../../../core/navigation';

const ICONS: NavIcon[] = [
  'home',
  'disc',
  'shelf',
  'sort',
  'bookmark',
  'inbox',
  'settings',
  'help',
  'more',
  'scan',
  'globe',
  'theme',
];

describe('NavIconComponent', () => {
  it('renders an svg for every navigation icon', () => {
    const fixture = TestBed.createComponent(NavIconComponent);

    for (const name of ICONS) {
      fixture.componentRef.setInput('name', name);
      fixture.detectChanges();

      const svg: SVGElement = fixture.nativeElement.querySelector('svg');
      expect(svg, name).toBeTruthy();
      expect(svg.getAttribute('width')).toBe('22');
    }
  });

  it('forwards the size and stroke width', () => {
    const fixture = TestBed.createComponent(NavIconComponent);
    fixture.componentRef.setInput('name', 'disc');
    fixture.componentRef.setInput('size', 30);
    fixture.componentRef.setInput('strokeWidth', 2.5);
    fixture.detectChanges();

    const svg: SVGElement = fixture.nativeElement.querySelector('svg');
    expect(svg.getAttribute('width')).toBe('30');
    expect(svg.getAttribute('height')).toBe('30');
    expect(svg.getAttribute('stroke-width')).toBe('2.5');
  });

  it('draws the shelf icon as a grid', () => {
    const fixture = TestBed.createComponent(NavIconComponent);
    fixture.componentRef.setInput('name', 'shelf');
    fixture.detectChanges();

    const svg: SVGElement = fixture.nativeElement.querySelector('svg');
    expect(svg.querySelector('rect')).toBeTruthy();
    expect(svg.querySelectorAll('path').length).toBe(1);
  });
});
