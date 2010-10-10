# coding: utf-8
import random

class Util:
    """ Функции которые не возможно пихнуть в другие разделы """
    def __init__(self):
        pass
    
    @classmethod
    def get_random_rgb_color_string(self):
        """ Получение рандомного RGB цвета типа WEB-colors """
        rgb_string = "#"
        rgbColorsCount = 3
        deltaColorExchange = 51
        numberOfColorGradations = 256
        indexOfZeroColor = random.randrange(rgbColorsCount)
        
        i = 0
        while i < rgbColorsCount:
            if i != indexOfZeroColor:
                rpb_part = random.randrange(0, numberOfColorGradations, deltaColorExchange)
                if rpb_part == 0: 
                    rgb_string += "00"
                else:
                    rgb_string += hex(rpb_part)[-2:]
            else:
                rgb_string += "00"
                
            i += 1
                
        return rgb_string