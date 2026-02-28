import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmoteDisplayComponent } from './emote-display';

describe('EmoteDisplayComponent', () => {
  let fixture: ComponentFixture<EmoteDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmoteDisplayComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(EmoteDisplayComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should not render when emote is null', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.emote-toast');
    expect(el).toBeNull();
  });

  it('should render emote text when set', () => {
    fixture.componentRef.setInput('emote', 'Wow');
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('.emote-toast');
    expect(el).toBeTruthy();
    expect(el.textContent.trim()).toBe('Wow');
  });
});
