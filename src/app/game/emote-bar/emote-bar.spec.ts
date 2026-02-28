import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmoteBarComponent } from './emote-bar';

describe('EmoteBarComponent', () => {
  let fixture: ComponentFixture<EmoteBarComponent>;
  let component: EmoteBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmoteBarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(EmoteBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render three emote buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent.trim()).toBe('Wow');
    expect(buttons[1].textContent.trim()).toBe('Well Played');
    expect(buttons[2].textContent.trim()).toBe('Interesting');
  });

  it('should emit emoteSent when a button is clicked', () => {
    const spy = vi.fn();
    component.emoteSent.subscribe(spy);
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[1].click();
    expect(spy).toHaveBeenCalledWith('Well Played');
  });
});
